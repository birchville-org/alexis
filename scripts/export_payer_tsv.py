#!/usr/bin/env python3
"""
export_payer_tsv.py

Synthesizes the complete vocabulary of Alois Payer's Sanskrit course by merging:
  1. The canonical curated Glossary (glossar.md by Simone Dünneisen / Alois Payer)
  2. The lesson-by-lesson Wortlisten (wortliste.md & lektion files)

Exports the consolidated vocabulary as clean TSV files in 3 volume groups:
  - Band 1: Grundkurs (Lektionen 1–20)
  - Band 2: Aufbaukurs (Lektionen 21–40)
  - Band 3: Vertiefung (Lektionen 41–61)
"""

import json
import re
from pathlib import Path

PAYER_DOCS = Path("/Volumes/SanDisk1TB/proj/Payer/docs/lektionen")
ALEXIS_OUT = Path("/Volumes/SanDisk1TB/proj/Alexis/data/corpora/payer")
PAYER_OUT = Path("/Volumes/SanDisk1TB/proj/Payer/dist_exports")
ALEXIS_JSON = Path("/Volumes/SanDisk1TB/proj/Alexis/data/corpora/payer_sanskrit.json")

def deva_to_iast(text: str) -> str:
    """Accurate Sanskrit Devanagari to IAST transliteration."""
    vowels = {
        'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū',
        'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ', 'ॡ': 'ḹ',
        'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'
    }
    matras = {
        'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū',
        'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ',
        'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au'
    }
    consonants = {
        'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ',
        'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
        'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ',
        'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
        'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
        'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
        'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h',
        'ळ': 'ḷ'
    }
    other = {
        'ं': 'ṃ', 'ः': 'ḥ', 'ँ': 'm̐', 'ऽ': "'"
    }
    virama = '्'

    res = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in consonants:
            cons = consonants[c]
            if i + 1 < n:
                next_c = text[i+1]
                if next_c == virama:
                    res.append(cons)
                    i += 2
                    continue
                elif next_c in matras:
                    res.append(cons + matras[next_c])
                    i += 2
                    continue
            res.append(cons + 'a')
            i += 1
        elif c in vowels:
            res.append(vowels[c])
            i += 1
        elif c in other:
            res.append(other[c])
            i += 1
        else:
            res.append(c)
            i += 1
    return ''.join(res)

def clean_meaning(text: str) -> str:
    """Cleans markdown, links, and annotations from definition string."""
    t = text.strip()
    t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t) # markdown links
    t = re.sub(r'!\[[^\]]*\]\([^\)]+\)', '', t) # images
    t = re.sub(r'\s+', ' ', t).strip()
    t = t.rstrip('.')
    return t

def parse_gender_pos(info_str: str) -> tuple[str, str]:
    """Resolves (pos, gender) from Payer grammar indicators."""
    s = (info_str or '').lower().strip().rstrip('.')
    if s in ['m', 'mask', 'maskulinum']:
        return ('noun', 'm')
    if s in ['f', 'fem', 'femininum']:
        return ('noun', 'f')
    if s in ['n', 'neutr', 'neutrum']:
        return ('noun', 'n')
    if s in ['m/f', 'm.f', 'm.n', 'f.n']:
        return ('noun', 'm/f')
    if s == '3' or 'adj' in s:
        return ('adj', '-')
    if 'adv' in s:
        return ('adv', '-')
    if 'postp' in s:
        return ('postp', '-')
    if 'pron' in s:
        return ('pron', '-')
    if 'ptk' in s or 'part' in s:
        return ('ptk', '-')
    if 'verb' in s or re.search(r'\d+\s*[apup]', s):
        return ('verb', '-')
    return ('noun', '-')

def parse_glossar() -> dict[str, dict]:
    """Parses the canonical glossar.md table."""
    gl_path = PAYER_DOCS / "glossar.md"
    if not gl_path.exists():
        return {}

    lines = gl_path.read_text(encoding="utf-8").splitlines()
    entries = {}

    for line in lines:
        line = line.strip()
        if not line.startswith('|') or '⟪' not in line:
            continue
        parts = [p.strip() for p in line.split('|')[1:-1]]
        if len(parts) < 5:
            continue

        nat_match = re.search(r'⟪([^⟫]+)⟫', parts[0])
        if not nat_match:
            continue
        nat = nat_match.group(1).strip()

        trn_match = re.search(r'\[([^\]]+)\]', parts[1])
        trn = trn_match.group(1).strip() if trn_match else parts[1].strip()
        if not trn or trn == '—' or trn.startswith('http'):
            trn = deva_to_iast(nat)

        genus = parts[2].strip()
        meaning = clean_meaning(parts[3])
        if not meaning or meaning == 'br':
            continue

        les_match = re.search(r'\d+', parts[4])
        les = int(les_match.group()) if les_match else 1

        pos, gen = parse_gender_pos(genus)
        vol = 'payer_vol1' if les <= 20 else ('payer_vol2' if les <= 40 else 'payer_vol3')

        entries[nat] = {
            'volume': vol,
            'lesson': str(les),
            'native': nat,
            'transliteration': trn,
            'pos': pos,
            'gender': gen,
            'meaning': meaning,
            'tags': f"glossar;lektion{les:02d}",
            'notes': f"Glossar-Eintrag (Genus: {genus})" if genus and genus != '—' else ''
        }

    return entries

def parse_wortliste() -> list[dict]:
    """Parses the lesson-by-lesson wortliste.md overview."""
    wl_path = PAYER_DOCS / "wortliste.md"
    if not wl_path.exists():
        return []

    text = wl_path.read_text(encoding="utf-8")
    sections = re.split(r'^## Lektion (\d+)', text, flags=re.MULTILINE)

    entries = []

    for i in range(1, len(sections), 2):
        les_num = int(sections[i])
        body = sections[i+1]
        vol_id = 'payer_vol1' if les_num <= 20 else ('payer_vol2' if les_num <= 40 else 'payer_vol3')

        lines = body.splitlines()
        last_entry = None

        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith(':::') or line.startswith('!') or line.startswith('Abb.:') or line.startswith('Beschriftung:'):
                continue
            if line.startswith('(') and not line.startswith('(**'):
                continue
            if '⟪' not in line:
                continue

            clean_line = re.sub(r'^(?:[0-9]+\.|\-)\s*', '', line).strip()

            # Sub-forms
            m_sub = re.match(r'^(?:\*\*)?(Fut\.|Pass\.|PPP|Inf\.|Kaus\.)(?:\*\*)?\s*⟪([^⟫]+)⟫(?:\s*\(?([^\)\n]+)\)?)?', clean_line)
            if m_sub and last_entry:
                form_type = m_sub.group(1).rstrip('.')
                form_nat = m_sub.group(2).strip()
                form_trn = deva_to_iast(form_nat)
                last_entry['notes'] = (last_entry.get('notes', '') + f"; {form_type}: {form_nat} ({form_trn})").lstrip('; ')
                continue

            # Verbs with class & forms
            m_verb1 = re.search(r'\*\*([^\*]+)\*\*\s+(\d+\s*[A-ZĀU]+)\s*\(([^\)]+)\)\s*⟪([^⟫]+)⟫\s*⟪([^⟫]+)⟫\s*[:=]\s*(.+)', clean_line)
            if m_verb1:
                r_trn, cls, p_trn, r_nat, p_nat, mng = m_verb1.groups()
                entry = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': p_nat.strip(),
                    'transliteration': f"{r_trn.strip()} ({p_trn.strip()})",
                    'pos': 'verb',
                    'gender': '-',
                    'meaning': clean_meaning(mng),
                    'tags': f"verb;klasse_{cls.strip()};lektion{les_num:02d}",
                    'notes': f"Wurzel ⟪{r_nat.strip()}⟫ ({r_trn.strip()}), Klasse {cls.strip()}"
                }
                entries.append(entry)
                last_entry = entry
                continue

            # Later lesson verb
            m_verb2 = re.search(r'^⟪([^⟫]+)⟫\s+(\d+[A-ZĀU]+)\s+⟪([^⟫]+)⟫\s*(?::\s*|\s+)(.+)', clean_line)
            if m_verb2:
                r_nat, cls, p_nat, mng = m_verb2.groups()
                r_trn = deva_to_iast(r_nat.strip())
                p_trn = deva_to_iast(p_nat.strip())
                entry = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': p_nat.strip(),
                    'transliteration': f"{r_trn} ({p_trn})",
                    'pos': 'verb',
                    'gender': '-',
                    'meaning': clean_meaning(mng),
                    'tags': f"verb;klasse_{cls.strip()};lektion{les_num:02d}",
                    'notes': f"Wurzel ⟪{r_nat.strip()}⟫ ({r_trn}), Klasse {cls.strip()}"
                }
                entries.append(entry)
                last_entry = entry
                continue

            # Dual entry
            m_dual = re.search(r'\*\*([^\*]+)\*\*\s*([mfna3\d\.\s]+)?\s*/\s*\*\*([^\*]+)\*\*\s*([mfna3\d\.\s]+)?\s*(?:=|\(|=?\s*⟪)\s*([^⟪]*?)⟪([^⟫]+)⟫\s*(?:/\s*|oder\s*)⟪([^⟫]+)⟫(?:\)|)\s*[:=]\s*(.+)', clean_line)
            if m_dual:
                t1, g1, t2, g2, _, n1, n2, mng = m_dual.groups()
                pos, gen = parse_gender_pos(g1 or g2 or 'noun')
                cm = clean_meaning(mng)
                e1 = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': n1.strip(),
                    'transliteration': t1.strip(),
                    'pos': pos,
                    'gender': gen,
                    'meaning': cm,
                    'tags': f"lektion{les_num:02d}",
                    'notes': ''
                }
                e2 = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': n2.strip(),
                    'transliteration': t2.strip(),
                    'pos': pos,
                    'gender': gen,
                    'meaning': cm,
                    'tags': f"lektion{les_num:02d}",
                    'notes': ''
                }
                entries.extend([e1, e2])
                last_entry = e2
                continue

            # Standard entry
            m_std = re.search(r'\*\*([^\*]+)\*\*\s*([mfna3\d\.\s/ĀUPUAdv]+)?(?:\s*[\-=–]+\s*|\s*\(|\s*)⟪([^⟫]+)⟫(?:\)|)\s*[:=]\s*(.+)', clean_line)
            if m_std:
                trn, info, nat, mng = m_std.groups()
                pos, gen = parse_gender_pos(info or '')
                entry = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': nat.strip(),
                    'transliteration': trn.strip(),
                    'pos': pos,
                    'gender': gen,
                    'meaning': clean_meaning(mng),
                    'tags': f"lektion{les_num:02d}",
                    'notes': ''
                }
                entries.append(entry)
                last_entry = entry
                continue

            # Native first
            m_nat = re.search(r'^⟪([^⟫]+)⟫\s*([mfna3\d\.\s/ĀUPUAdv]+)?\s*[:=]\s*(.+)', clean_line)
            if m_nat:
                nat, info, mng = m_nat.groups()
                nat_clean = nat.strip()
                pos, gen = parse_gender_pos(info or '')
                trn = deva_to_iast(nat_clean)
                entry = {
                    'volume': vol_id,
                    'lesson': str(les_num),
                    'native': nat_clean,
                    'transliteration': trn,
                    'pos': pos,
                    'gender': gen,
                    'meaning': clean_meaning(mng),
                    'tags': f"lektion{les_num:02d}",
                    'notes': ''
                }
                entries.append(entry)
                last_entry = entry
                continue

    return entries

def main():
    ALEXIS_OUT.mkdir(parents=True, exist_ok=True)
    PAYER_OUT.mkdir(parents=True, exist_ok=True)

    print("📖 Lade Glossar (glossar.md)...")
    glossar_dict = parse_glossar()
    print(f"   -> {len(glossar_dict)} kanonische Glossareinträge geladen.")

    print("📖 Lade Lektions-Wortlisten (wortliste.md)...")
    wortliste_entries = parse_wortliste()
    print(f"   -> {len(wortliste_entries)} Lektionseinträge extrahiert.")

    # Merge: Start with glossar, supplement with wortliste
    consolidated = dict(glossar_dict)
    supplements = 0
    enriched = 0

    for item in wortliste_entries:
        nat = item['native']
        if nat not in consolidated:
            consolidated[nat] = item
            supplements += 1
        else:
            # Enrich existing glossar entry with additional lesson definition or grammatical notes
            existing = consolidated[nat]
            mng = item['meaning'].strip()
            if mng and mng not in existing['meaning'] and existing['meaning'] not in mng:
                existing['meaning'] = f"{existing['meaning']}; {mng}"
                enriched += 1
            if item.get('notes') and item['notes'] not in existing.get('notes', ''):
                existing['notes'] = (existing.get('notes', '') + f"; {item['notes']}").lstrip('; ')

    total_count = len(consolidated)
    print(f"✨ Synthese abgeschlossen: {total_count} Vokabeln gesamt ({supplements} Ergänzungen, {enriched} Bedeutungsanreicherungen).")

    all_entries = sorted(consolidated.values(), key=lambda x: (int(x['lesson']), x['transliteration']))

    # Divide into 3 volume groups (20er-Gruppen)
    vol1_entries = [e for e in all_entries if e['volume'] == 'payer_vol1']
    vol2_entries = [e for e in all_entries if e['volume'] == 'payer_vol2']
    vol3_entries = [e for e in all_entries if e['volume'] == 'payer_vol3']

    groups = [
        ("payer_sanskrit_vol1.tsv", vol1_entries, "Band 1: Grundkurs (Lektionen 1–20)"),
        ("payer_sanskrit_vol2.tsv", vol2_entries, "Band 2: Aufbaukurs (Lektionen 21–40)"),
        ("payer_sanskrit_vol3.tsv", vol3_entries, "Band 3: Vertiefung (Lektionen 41–61)"),
    ]

    header = "volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags\n"

    for filename, item_list, desc in groups:
        lines = [header]
        for item in item_list:
            row = f"{item['volume']}\t{item['lesson']}\t{item['native']}\t{item['transliteration']}\t{item['pos']}\t{item['gender']}\t{item['meaning']}\t{item['tags']}\n"
            lines.append(row)

        content = "".join(lines)
        alexis_file = ALEXIS_OUT / filename
        payer_file = PAYER_OUT / filename

        alexis_file.write_text(content, encoding="utf-8")
        payer_file.write_text(content, encoding="utf-8")

        print(f"✅ {desc} -> {len(item_list)} Vokabeln exportiert nach:")
        print(f"   - {alexis_file}")
        print(f"   - {payer_file}")

    # Build full JSON bundle for Alexis
    unique_lessons = sorted(list(set(int(e['lesson']) for e in all_entries)))
    lesson_objs = []
    for num in unique_lessons:
        vol = "payer_vol1" if num <= 20 else ("payer_vol2" if num <= 40 else "payer_vol3")
        lesson_objs.append({
            "id": f"payer_l{num:02d}",
            "volume_id": vol,
            "lesson_number": num,
            "title": f"Lektion {num}",
            "sort_order": num
        })

    entry_objs = []
    for idx, e in enumerate(all_entries, 1):
        les_num = int(e['lesson'])
        defs = [{"lang": "de", "meaning": e['meaning']}]
        if e.get('notes'):
            defs[0]['notes'] = e['notes']
        entry_objs.append({
            "id": f"payer_l{les_num:02d}_{idx:04d}",
            "corpus_id": "payer-sanskrit",
            "volume_id": e['volume'],
            "lesson_id": f"payer_l{les_num:02d}",
            "lemma_native": e['native'],
            "lemma_translit": e['transliteration'],
            "pos": e['pos'],
            "gender": e['gender'] if e['gender'] != '-' else None,
            "definitions": defs,
            "tags": [t for t in e['tags'].split(';') if t]
        })

    bundle = {
        "corpus": {
            "id": "payer-sanskrit",
            "title": "Sanskritkurs — Alois Payer",
            "lang_code": "sa",
            "script": "Deva",
            "target_lang": "de",
            "description": "Systematischer Sanskrit-Lehrgang von Prof. Alois Payer (Lektionen 1–61), konsolidiert aus Glossar und Wortlisten."
        },
        "volumes": [
            {
                "id": "payer_vol1",
                "corpus_id": "payer-sanskrit",
                "title": "Grundkurs (Lektionen 1–20)",
                "sort_order": 1,
                "level": "Grundstufe"
            },
            {
                "id": "payer_vol2",
                "corpus_id": "payer-sanskrit",
                "title": "Aufbaukurs (Lektionen 21–40)",
                "sort_order": 2,
                "level": "Mittelstufe"
            },
            {
                "id": "payer_vol3",
                "corpus_id": "payer-sanskrit",
                "title": "Vertiefung (Lektionen 41–61)",
                "sort_order": 3,
                "level": "Oberstufe"
            }
        ],
        "lessons": lesson_objs,
        "entries": entry_objs
    }

    ALEXIS_JSON.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Alexis Korpus-Bundle aktualisiert: {ALEXIS_JSON} ({len(entry_objs)} Einträge, {len(lesson_objs)} Lektionen)")

if __name__ == "__main__":
    main()
