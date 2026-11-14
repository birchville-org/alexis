# Redaktions- & Validierungsworkflow (Hindi & Sanskrit)

Dieses Dokument beschreibt den verbindlichen Prozess für Redaktoren zum Prüfen, Anreichern und Veröffentlichen neuer Lektionen und Korpusdaten in Alexis.

---

## 1. Architekturprinzip: Strikte Rollentrennung

| Rolle | Umgebung | Rechte & Datenfluss |
| :--- | :--- | :--- |
| **Lernende (Nutzer)** | Online Web-App / PWA (`birchville-org.github.io/alexis/`) | **Read-Only-Referenz**: Kein Upload/Import neuer Wörterbücher in der Online-App. Persönliche Lernstände (Box 1–5) verbleiben zu 100 % lokal in `IndexedDB` / `localStorage`. Export per TSV (`📥 TSV`) jederzeit möglich. |
| **Redaktor (Repo-Inhaber)** | Lokale Workstation + Git-Repository (`birchville-org/alexis`) | Erstellt Lektions-TSVs, führt das lokale Validierungs- & Anreicherungsskript aus und publiziert geprüfte Änderungen via `git push`. |

---

## 2. Die 4 Stufen der Redaktions-Pipeline

```text
[Roh-Vokabeln / Lehrbuch-TSV]
         │
         ▼
 1. Lokales Prüf- & Anreicherungs-Skript (scripts/validate_and_import_hindi.py)
    ├─ Massenprüfung bestehender Tabellen (Free Dictionary API, kein 200er-Limit)
    ├─ Präzise Genus- & Bedeutungsgenerierung (Lexicala API + SQLite-Cache)
    └─ IAST-Prüfung auf Schwa-Tilgung & Nukta (IPA-Abgleich + optionaler LLM-Check)
         │
         ▼
 2. Bereinigte TSV / Prüfbericht (Menschliche Freigabe durch den Redaktor)
         │
         ▼
 3. Einpflegen in data/corpora/hindi_bolo.json (--apply)
    (Automatische Deduplizierung, Bedeutungs-Merging, Lektionszuordnung)
         │
         ▼
 4. Git Push & Automatischer PWA-Rollout
    ├─ GitHub Actions baut die PWA neu und aktualisiert GitHub Pages
    └─ Nutzer-PWAs synchronisieren neue Lektionen ohne Verlust lokaler Lernstände
```

---

## 3. API-Matrix & lokaler SQLite-Cache

| Aufgabe | Dienst / Methode | Begründung |
| :--- | :--- | :--- |
| **Massenprüfung bestehender Tabellen** | **Free Dictionary API** + lokales Python-Skript | Keine strikte 200-Abfragen-Grenze wie im kostenlosen Lexicala-Tarif. |
| **Präzise Genus- & Bedeutungsgenerierung** | **Lexicala API** + lokaler SQLite-Cache (`scripts/.cache/hindi_lexicon.sqlite`) | Liefert zuverlässig Genus (`m.` / `f.`), Wortart und Beispielsätze als strukturierte JSON-Felder; jedes Wort wird maximal einmal angefragt. |
| **IAST-Prüfung (Schwa-Tilgung & Nukta)** | **Regelbasierter Hindi-Check + IPA-Abgleich + optionaler LLM-Check** | Reine Zeichen-Transliteratoren scheitern an der Hindi-Aussprache; die Kombination fängt falsche End-`-a` (z. B. `kitāba` statt `kitāb`) zuverlässig ab. |

---

## 4. Bedienung des CLI-Skripts (`scripts/validate_and_import_hindi.py`)

### Umgebungsvariablen (optional, niemals committen!)
- `LEXICALA_API_KEY`: RapidAPI / Lexicala API-Schlüssel für Genus- & Wortart-Abfragen.
- `GEMINI_API_KEY`: Optionaler Google Gemini API-Schlüssel für Zweifelsfälle bei Schwa-Tilgung und Nukta.

### Typische Aufrufe

```bash
# 1. Bestehendes Korpus offline auf Schwa-Tilgung, Nukta und fehlende Genera prüfen
python3 scripts/validate_and_import_hindi.py --audit-corpus --skip-network

# 2. Neue Lektions-TSV vorab prüfen (Dry-Run mit Free Dictionary API + SQLite-Cache)
python3 scripts/validate_and_import_hindi.py --input data/raw/hb1_l04.tsv

# 3. Geprüfte Lektions-TSV in data/corpora/hindi_bolo.json einspielen
python3 scripts/validate_and_import_hindi.py --input data/raw/hb1_l04.tsv --apply
```
