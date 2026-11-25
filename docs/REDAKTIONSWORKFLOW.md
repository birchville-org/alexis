# Redaktions- & Validierungsworkflow (Hindi & Sanskrit)

Dieses Dokument beschreibt den verbindlichen Prozess für Redaktoren zum Prüfen, Anreichern und Veröffentlichen neuer Lektionen und Korpusdaten in Alexis.

---

## 1. Architekturprinzip: Strikte Rollentrennung

| Rolle | Umgebung | Rechte & Datenfluss |
| :--- | :--- | :--- |
| **Lernende (Browser)** | Online Web-App (`alexis.birchville.org` / `docs.birchville.org/alexis/`) | **Read-Only-Referenz**: Prüf-, Editier- und Importfunktionen am Wortschatz ausgeschaltet. Lernstände (Box 1–5) und persönliche Notizen bleiben lokal in `IndexedDB`. Export per TSV (`📥 TSV`) jederzeit möglich. |
| **Externer Gutachter** | Browser mit `?review=1` (`https://alexis.birchville.org/?review=1`) | **Delta-Review ohne Git**: Kann im Vokabel-Explorer Einträge korrigieren (`✏️ Eintrag bearbeiten`) und Kommentare hinterlegen. Änderungen liegen nur lokal (`entry_overrides` in `IndexedDB`) und werden per `📤 Korrektur-Delta herunterladen (.json)` an die Redaktion geschickt. |
| **Eigenbestand (PWA / Desktop-App)** | Installierte PWA (`IndexedDB`) oder Desktop-App (`SQLite`) | **Lokal editierbar**: Eigene TSV-Listen, Einzelwort-Korrekturen und `Online prüfen` wirken lokal auf dem eigenen Gerät. |
| **Redaktor (Repo-Inhaber)** | Lokaler Dev-Server (`localhost:5180`) + Git-Repository (`birchville-org/alexis`) | Prüft eingereichte Deltas (`📥 Delta prüfen`), importiert/editiert direkt nach `data/corpora/*.json` (`Git-Sync`) oder nutzt `scripts/validate_and_import_hindi.py`, und veröffentlicht via `/code-review` -> `/release`. |

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

---

## 5. Externer Gutachter-Workflow (`?review=1` & Delta-Dateien)

Externe Fachgutachter benötigen weder Git noch lokale Entwicklungsumgebung:

1. **Gutachter-Link öffnen:** `https://alexis.birchville.org/?review=1` öffnet direkt die **Vokabelliste** im Gutachter-Modus (`entry_overrides` lokal in `IndexedDB`; der Server bleibt unverändert).
2. **Korrigieren & kommentieren:** Über `✏️ Eintrag bearbeiten` lassen sich Devanāgarī, IAST, Wortart, Genus, Bedeutungen, Spalte `notes`, Tags sowie ein optionaler **Gutachter-Kommentar** anpassen.
3. **Delta exportieren:** Über **`📤 Korrektur-Delta herunterladen (.json)`** im Banner wird eine schlanke Datei im Schema `alexis-review-delta-v1` (mit `before`/`after`-Diffs und Kommentaren) erzeugt und per E-Mail an den Redaktor gesendet.
4. **Übernahme ins Git-Repository:** Auf dem lokalen Redaktionsserver (`http://localhost:5180/`) lädt der Redaktor die Datei über **`📥 Delta prüfen`**, prüft jedes Feld (`Vorher -> Nachher` + Kommentar), wählt gezielt per Checkbox aus und klickt **`✓ Freigeben & Korrekturen anwenden`**. `Git-Sync` schreibt die freigegebenen Änderungen direkt Biome-formatiert in `data/corpora/*.json`.

*(Test-Parameter für die Entwicklung: `?readonly=1`, z. B. `http://localhost:5180/?readonly=1`, simuliert lokal die schreibgeschützte Server-Ansicht.)*
