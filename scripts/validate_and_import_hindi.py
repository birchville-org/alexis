#!/usr/bin/env python3
"""
validate_and_import_hindi.py

Lokale Redaktions-Pipeline für Hindi-Vokabeltabellen in Alexis:
1. Massenprüfung bestehender Tabellen via Free Dictionary API (ohne 200er-Limit)
2. Präzise Genus- & Wortart-Validierung via Lexicala API mit SQLite-Cache
3. IAST-Prüfung (Schwa-Tilgung & Nukta) via Regelwerk, IPA-Abgleich & optionalem LLM-Check
4. Kontrollierter Import geprüfter TSV-Dateien in data/corpora/hindi_bolo.json
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
CORPUS_PATH = ROOT_DIR / "data" / "corpora" / "hindi_bolo.json"
CACHE_DB_PATH = Path(__file__).resolve().parent / ".cache" / "hindi_lexicon.sqlite"

# Devanagari characters with Nukta and their expected IAST counterparts
NUKTA_RULES: dict[str, tuple[str, ...]] = {
    "क़": ("q",),
    "ख़": ("ḵẖ", "kh", "x"),
    "ग़": ("ġ", "gh"),
    "ज़": ("z",),
    "ड़": ("ṛ",),
    "ढ़": ("ṛh",),
    "फ़": ("f",),
}

# Known Hindi words where final -a in IAST is legitimate (loanwords, conjuncts, particles)
FINAL_A_ALLOWLIST = {
    "na",
    "ca",
    "va",
    "ha",
    "ka",
    "ba",
    "sa",
    "śukriya",
    "accha",
}


@dataclass
class ValidationIssue:
    severity: str  # "ERROR" | "WARN" | "INFO"
    code: str
    message: str


@dataclass
class VocabRow:
    volume: str
    lesson: int
    native: str
    translit: str
    pos: str
    gender: str | None
    meaning_de: str
    tags: list[str]
    issues: list[ValidationIssue] = field(default_factory=list)


class LexiconCache:
    """Persistent SQLite cache for Free Dictionary, Lexicala, and LLM checks."""

    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(db_path))
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_cache (
                provider TEXT NOT NULL,
                lemma TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (provider, lemma)
            )
            """
        )
        self.conn.commit()

    def get(self, provider: str, lemma: str) -> dict[str, Any] | None:
        cur = self.conn.execute(
            "SELECT payload FROM api_cache WHERE provider = ? AND lemma = ?",
            (provider, lemma),
        )
        row = cur.fetchone()
        if not row:
            return None
        return json.loads(row[0])

    def set(self, provider: str, lemma: str, payload: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            """
            INSERT OR REPLACE INTO api_cache (provider, lemma, payload, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (provider, lemma, json.dumps(payload, ensure_ascii=False), now),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()


def fetch_free_dictionary(lemma: str, cache: LexiconCache) -> dict[str, Any]:
    """Queries Free Dictionary API (hi) with SQLite cache."""
    cached = cache.get("free_dict", lemma)
    if cached is not None:
        return cached

    url = f"https://api.dictionaryapi.dev/api/v2/entries/hi/{urllib.parse.quote(lemma)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Alexis-Editorial/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            phonetics = [p.get("text") for p in data[0].get("phonetics", []) if p.get("text")]
            meanings = data[0].get("meanings", [])
            pos_list = [m.get("partOfSpeech") for m in meanings if m.get("partOfSpeech")]
            payload = {"found": True, "ipa": phonetics, "pos": pos_list}
    except urllib.error.HTTPError as err:
        payload = {"found": False, "status": err.code}
    except Exception as err:
        payload = {"found": False, "error": str(err)}

    cache.set("free_dict", lemma, payload)
    return payload


def fetch_lexicala(
    lemma: str, cache: LexiconCache, api_key: str, budget: list[int]
) -> dict[str, Any] | None:
    """Queries Lexicala API with strict SQLite cache and per-run query budget."""
    cached = cache.get("lexicala", lemma)
    if cached is not None:
        return cached

    if budget[0] <= 0:
        return None
    budget[0] -= 1

    url = f"https://lexicala1.p.rapidapi.com/search-entries?text={urllib.parse.quote(lemma)}&language=hi"
    req = urllib.request.Request(
        url,
        headers={
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "lexicala1.p.rapidapi.com",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            gender = None
            pos = None
            examples: list[str] = []
            if results:
                head = results[0].get("headword", {})
                if isinstance(head, list) and head:
                    head = head[0]
                gender = head.get("gender")
                pos = head.get("pos")
                for sense in results[0].get("senses", [])[:2]:
                    for ex in sense.get("examples", [])[:1]:
                        if ex.get("text"):
                            examples.append(ex["text"])
            payload = {
                "found": bool(results),
                "gender": gender,
                "pos": pos,
                "examples": examples,
            }
    except Exception as err:
        payload = {"found": False, "error": str(err)}

    cache.set("lexicala", lemma, payload)
    return payload


def check_schwa_and_nukta(row: VocabRow) -> None:
    """Deterministic Hindi IAST checks for missing schwa deletion and nukta consonants."""
    native = row.native.strip()
    translit = row.translit.strip()

    if not native or not translit:
        row.issues.append(
            ValidationIssue("ERROR", "EMPTY_FIELD", "Native- oder IAST-Feld ist leer.")
        )
        return

    # 1. Nukta consistency check
    translit_lower = translit.lower()
    for dev_nukta, expected_iast in NUKTA_RULES.items():
        if dev_nukta in native and not any(tok in translit_lower for tok in expected_iast):
            row.issues.append(
                ValidationIssue(
                    "WARN",
                    "NUKTA_MISMATCH",
                    f"Devanāgarī enthält '{dev_nukta}', aber IAST '{translit}' enthält keines von {expected_iast}.",
                )
            )

    # 2. Hindi Schwa deletion check at word end:
    # Check the last token (supports multi-word expressions like "न (और) न").
    # Exclude Sanskrit -iya/-ya tatsamas after i/ī or conjuncts (e.g. प्रिय -> priya)
    # and monosyllabic final tokens (e.g. "na").
    last_native_word = native.split()[-1]
    last_translit_word = translit_lower.split()[-1]
    last_char = last_native_word[-1] if last_native_word else ""
    is_devanagari_consonant = "\u0915" <= last_char <= "\u0939"
    has_conjunct_before = len(last_native_word) >= 2 and last_native_word[-2] == "\u094d"
    is_iya_tatsama = last_native_word.endswith(("िय", "ीय"))

    if (
        is_devanagari_consonant
        and not has_conjunct_before
        and not is_iya_tatsama
        and len(last_native_word) >= 2
        and last_translit_word.endswith("a")
        and not last_translit_word.endswith("ā")
        and last_translit_word not in FINAL_A_ALLOWLIST
    ):
        row.issues.append(
            ValidationIssue(
                "WARN",
                "SCHWA_DELETION",
                f"Verdächtiges End-'-a' in IAST '{translit}' (Hindi-Schwa-Tilgung prüfen -> evtl. '{translit[:-1]}').",
            )
        )

    # 3. Noun gender check
    pos_l = row.pos.lower()
    if ("noun" in pos_l or "subst" in pos_l or pos_l == "n") and (
        not row.gender or row.gender == "-"
    ):
        row.issues.append(
            ValidationIssue(
                "ERROR",
                "MISSING_GENDER",
                "Substantiv ohne grammatisches Geschlecht (m/f/n/m/f).",
            )
        )


def check_llm_schwa(
    row: VocabRow, cache: LexiconCache, gemini_key: str
) -> dict[str, Any] | None:
    """Optional Gemini check for IAST schwa deletion & nukta verification."""
    cache_key = f"{row.native}|{row.translit}"
    cached = cache.get("gemini_schwa", cache_key)
    if cached is not None:
        return cached

    prompt = (
        "Prüfe das folgende Hindi-Wort auf korrekte IAST-Umschrift (insbesondere Hindi-Schwa-Tilgung "
        "und Nukta) sowie IPA. Antworte ausschließlich als kompaktes JSON mit den Schlüsseln: "
        '{"ok": true/false, "suggested_iast": "...", "ipa": "...", "note": "..."}.\n'
        f"Devanagari: {row.native}\nAktuelles IAST: {row.translit}\nWortart: {row.pos}"
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={urllib.parse.quote(gemini_key)}"
    )
    body = json.dumps(
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
            txt = raw["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(txt)
    except Exception as err:
        parsed = {"ok": True, "error": str(err)}

    cache.set("gemini_schwa", cache_key, parsed)
    return parsed


def sanitize_text(val: str | None) -> str:
    if not val:
        return ""
    return re.sub(r"[\r\n\t]+", " ", val).strip()


def load_tsv(path: Path) -> list[VocabRow]:
    rows: list[VocabRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        if not reader.fieldnames:
            raise ValueError(f"TSV-Datei {path} hat keine Kopfzeile.")
        fields = {k.strip().lower(): k for k in reader.fieldnames}
        meaning_col = next((v for k, v in fields.items() if "meaning" in k), None)
        if "native" not in fields or not meaning_col:
            raise ValueError("Pflichtspalten 'native' und 'meaning*' fehlen.")

        for raw in reader:
            vol = sanitize_text(raw.get(fields.get("volume", ""), "hb1")) or "hb1"
            les_raw = sanitize_text(raw.get(fields.get("lesson", ""), "1")) or "1"
            les_num = int(re.sub(r"\D+", "", les_raw) or "1")
            native = sanitize_text(raw.get(fields["native"], ""))
            if not native:
                continue
            translit = sanitize_text(raw.get(fields.get("transliteration", ""), ""))
            pos = sanitize_text(raw.get(fields.get("pos", ""), ""))
            gender_raw = sanitize_text(raw.get(fields.get("gender", ""), ""))
            gender = None if gender_raw in ("", "-") else gender_raw
            meaning = sanitize_text(raw.get(meaning_col, ""))
            tags_raw = sanitize_text(raw.get(fields.get("tags", ""), ""))
            tags = [t.strip() for t in tags_raw.split(";") if t.strip()]
            rows.append(
                VocabRow(
                    volume=vol,
                    lesson=les_num,
                    native=native,
                    translit=translit,
                    pos=pos,
                    gender=gender,
                    meaning_de=meaning,
                    tags=tags,
                )
            )
    return rows


def load_corpus_rows(corpus: dict[str, Any]) -> list[VocabRow]:
    rows: list[VocabRow] = []
    lessons_by_id = {l["id"]: l["lesson_number"] for l in corpus.get("lessons", [])}
    for e in corpus.get("entries", []):
        les_num = lessons_by_id.get(e.get("lesson_id", ""), 1)
        meaning = "; ".join(d.get("meaning", "") for d in e.get("definitions", []))
        rows.append(
            VocabRow(
                volume=e.get("volume_id", "hb1"),
                lesson=int(les_num),
                native=e.get("lemma_native", ""),
                translit=e.get("lemma_translit", ""),
                pos=e.get("pos", ""),
                gender=e.get("gender"),
                meaning_de=meaning,
                tags=list(e.get("tags") or []),
            )
        )
    return rows


def validate_rows(
    rows: list[VocabRow],
    cache: LexiconCache,
    skip_network: bool,
    max_lexicala: int,
    use_llm: bool,
) -> None:
    lexicala_key = os.environ.get("LEXICALA_API_KEY", "").strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    budget = [max_lexicala]

    for row in rows:
        check_schwa_and_nukta(row)

        if skip_network:
            continue

        # 1. Free Dictionary API (mass check + IPA)
        fd = fetch_free_dictionary(row.native, cache)
        if fd.get("found") and fd.get("ipa"):
            ipa_str = ", ".join(fd["ipa"][:2])
            row.issues.append(
                ValidationIssue("INFO", "FREE_DICT_IPA", f"IPA gefunden: {ipa_str}")
            )

        # 2. Lexicala API (Genus & POS verification when needed or key present)
        if lexicala_key and (not row.gender or not row.pos):
            lex = fetch_lexicala(row.native, cache, lexicala_key, budget)
            if lex and lex.get("found"):
                if lex.get("gender") and not row.gender:
                    row.issues.append(
                        ValidationIssue(
                            "INFO",
                            "LEXICALA_GENDER",
                            f"Lexicala-Vorschlag Genus: {lex['gender']} (Wortart: {lex.get('pos')})",
                        )
                    )

        # 3. Optional LLM check for ambiguous Schwa / Nukta warnings
        if use_llm and gemini_key and any(i.code in ("SCHWA_DELETION", "NUKTA_MISMATCH") for i in row.issues):
            llm = check_llm_schwa(row, cache, gemini_key)
            if llm and not llm.get("ok", True):
                row.issues.append(
                    ValidationIssue(
                        "WARN",
                        "LLM_IAST_CHECK",
                        f"LLM-Vorschlag: '{llm.get('suggested_iast')}' (IPA: {llm.get('ipa')}) — {llm.get('note')}",
                    )
                )


def apply_rows_to_corpus(rows: list[VocabRow], corpus_path: Path) -> tuple[int, int]:
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    existing_lessons = {l["id"]: l for l in corpus.get("lessons", [])}
    existing_entries_by_native = {
        e["lemma_native"]: e for e in corpus.get("entries", [])
    }

    added = 0
    merged = 0
    for row in rows:
        lesson_id = f"{row.volume}_l{row.lesson:02d}"
        if lesson_id not in existing_lessons:
            les_obj = {
                "id": lesson_id,
                "volume_id": row.volume,
                "lesson_number": row.lesson,
                "title": f"Lektion {row.lesson}",
                "sort_order": row.lesson,
            }
            corpus["lessons"].append(les_obj)
            existing_lessons[lesson_id] = les_obj

        if row.native in existing_entries_by_native:
            entry = existing_entries_by_native[row.native]
            meanings = {d["meaning"] for d in entry.get("definitions", [])}
            if row.meaning_de and row.meaning_de not in meanings:
                entry["definitions"].append({"lang": "de", "meaning": row.meaning_de})
                merged += 1
            for tag in row.tags:
                if tag not in entry.setdefault("tags", []):
                    entry["tags"].append(tag)
        else:
            seq = sum(1 for e in corpus["entries"] if e.get("lesson_id") == lesson_id) + 1
            new_entry = {
                "id": f"{lesson_id}_{seq:03d}",
                "corpus_id": corpus["corpus"]["id"],
                "volume_id": row.volume,
                "lesson_id": lesson_id,
                "lemma_native": row.native,
                "lemma_translit": row.translit,
                "pos": row.pos,
                "gender": row.gender,
                "definitions": [{"lang": "de", "meaning": row.meaning_de}],
                "tags": row.tags,
            }
            corpus["entries"].append(new_entry)
            existing_entries_by_native[row.native] = new_entry
            added += 1

    corpus_path.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return added, merged


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Alexis Redaktions-Pipeline: Hindi-TSV-Validierung & Import"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--input", type=Path, help="Pfad zur neuen Lektions-TSV")
    group.add_argument(
        "--audit-corpus",
        action="store_true",
        help="Bestehendes data/corpora/hindi_bolo.json prüfen",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Geprüfte TSV-Einträge in data/corpora/hindi_bolo.json schreiben",
    )
    parser.add_argument(
        "--skip-network",
        action="store_true",
        help="Nur Offline-Regelchecks (Schwa-Tilgung, Nukta, Genus) ausführen",
    )
    parser.add_argument(
        "--max-lexicala",
        type=int,
        default=50,
        help="Maximale Anzahl neuer Lexicala-API-Abfragen pro Lauf (Standard: 50)",
    )
    parser.add_argument(
        "--llm-check",
        action="store_true",
        help="Verdachtsfälle zusätzlich mit Gemini prüfen (erfordert GEMINI_API_KEY)",
    )
    args = parser.parse_args()

    cache = LexiconCache(CACHE_DB_PATH)
    try:
        if args.audit_corpus:
            corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
            rows = load_corpus_rows(corpus)
            source_label = str(CORPUS_PATH.relative_to(ROOT_DIR))
        else:
            rows = load_tsv(args.input)
            source_label = str(args.input)

        validate_rows(
            rows,
            cache=cache,
            skip_network=args.skip_network,
            max_lexicala=args.max_lexicala,
            use_llm=args.llm_check,
        )

        errors = [
            (r, i) for r in rows for i in r.issues if i.severity == "ERROR"
        ]
        warns = [
            (r, i) for r in rows for i in r.issues if i.severity == "WARN"
        ]

        print(f"Geprüft: {len(rows)} Einträge aus {source_label}")
        print(f"Ergebnis: {len(errors)} Fehler (ERROR), {len(warns)} Hinweise (WARN)")

        for r, issue in (errors + warns)[:30]:
            print(
                f"  [{issue.severity}] {r.volume}/{r.lesson} {r.native} ({r.translit}) [{issue.code}]: {issue.message}"
            )
        if len(errors) + len(warns) > 30:
            print(f"  ... und {len(errors) + len(warns) - 30} weitere Meldungen.")

        if args.apply:
            if args.audit_corpus:
                print("--apply ist nur zusammen mit --input <TSV> zulässig.", file=sys.stderr)
                return 2
            if errors:
                print(
                    "Import abgebrochen: Bitte zuerst alle ERROR-Befunde beheben.",
                    file=sys.stderr,
                )
                return 1
            added, merged = apply_rows_to_corpus(rows, CORPUS_PATH)
            print(f"Import abgeschlossen: {added} neu hinzugefügt, {merged} Bedeutungen ergänzt.")

        return 0
    finally:
        cache.close()


if __name__ == "__main__":
    raise SystemExit(main())
