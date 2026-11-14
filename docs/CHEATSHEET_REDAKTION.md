# Chefredaktor-Cheat-Sheet: Neue Vokabeln in Alexis

Kompakter Leitfaden für den Workflow **Buchfoto ➔ TSV ➔ Prüfung ➔ Veröffentlichung**.

---

## 1. Buchfoto ➔ TSV-Tabelle

### Option A: Direkt hier im Chat (mit Skill `alexis-extraktion`)
1. Buchfotos hochladen.
2. Kurzanweisung senden:
   > `Extrahiere diese Seiten mit alexis-extraktion für hb1 Lektion 4.`

### Option B: In Gemini Notebook / externem Chat
Prompt-Vorlage zum Kopieren:
```text
Extrahiere alle Vokabeln aus den Buchfotos als UTF-8 TSV-Codeblock mit exakt diesen 8 Spalten:
volume	lesson	native	transliteration	pos	gender	meaning_de	tags

Regeln:
- volume: hb1 (oder hb2 / hb3)
- lesson: Lektionsnummer als Ganzzahl
- native: Devanāgarī mit exakten Nuktas (क़ ख़ ग़ ज़ ड़ ढ़ फ़)
- transliteration: modernes Hindi-IAST mit Schwa-Tilgung am Wortende (z. B. kitāb statt kitāba) und q/ḵẖ/ġ/z/ṛ/f
- pos: noun, verb, adj, adv, pron, postp oder ind
- gender: bei noun zwingend m, f, n oder m/f; sonst -
- meaning_de: deutsche Bedeutungen mit "; " trennen
- tags: kleingeschrieben, mit ";" trennen (z. B. nomen;a1;lektion4)
```

TSV-Output als Datei speichern, z. B. `hb1_l04.tsv` im Ordner `/Volumes/SanDisk1TB/proj/Alexis`.

---

## 2. Prüfen (Dry-Run — verändert nichts)

```bash
cd /Volumes/SanDisk1TB/proj/Alexis

# Offline-Schnellprüfung (Schwa-Tilgung, Nuktas, Pflicht-Genus):
python3 scripts/validate_and_import_hindi.py --input hb1_l04.tsv --skip-network

# Mit Online-Wörterbuchprüfung (Free Dictionary API + SQLite-Cache):
python3 scripts/validate_and_import_hindi.py --input hb1_l04.tsv
```

- **`[ERROR]`** (z. B. fehlendes Genus bei `noun`): In der `.tsv` korrigieren — sonst wird der Import blockiert.
- **`[WARN]`** (z. B. `SCHWA_DELETION` oder `NUKTA_MISMATCH`): Kurz gegenprüfen und ggf. in der `.tsv` anpassen.

---

## 3. Einspielen in `hindi_bolo.json`

```bash
python3 scripts/validate_and_import_hindi.py --input hb1_l04.tsv --apply
```
- Legt neue Lektionen automatisch an und führt Duplikate sauber zusammen.
- Danach optional lokal testen: `npm run dev`
- Die temporäre Datei `hb1_l04.tsv` kann anschließend gelöscht werden (nicht committen).

---

## 4. Veröffentlichen (PWA-Rollout)

1. Im Chat `/code-review` ➔ `/fix` ➔ `/release` ausführen  
   *(oder direkt committen und zu GitHub pushen)*.
2. GitHub Actions baut die PWA automatisch neu.
3. Alle Nutzer-PWAs erhalten die neue Lektion beim nächsten Online-Start ohne Verlust ihrer Lernstände.

---

## Wichtige Sonderbefehle

| Aufgabe | Befehl |
| :--- | :--- |
| Gesamtes Korpus offline prüfen | `python3 scripts/validate_and_import_hindi.py --audit-corpus --skip-network` |
| Mit Gemini-LLM-Zweitprüfung (benötigt `GEMINI_API_KEY`) | `python3 scripts/validate_and_import_hindi.py --input hb1_l04.tsv --llm-check` |
| Mit Lexicala Genus-API (benötigt `LEXICALA_API_KEY`, max. 50/Lauf) | `python3 scripts/validate_and_import_hindi.py --input hb1_l04.tsv --max-lexicala 50` |
