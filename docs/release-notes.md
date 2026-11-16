# Release Notes — Alexis (Ἀλέξις / Lexis)

## v0.4.0 (2026-11-16)

### Datenintegrität & Kernfunktionen
- **Hindi-Wörterbuch (`src/providers/hindiDictionary.ts`)**: Neuer Provider mit Inline-Definitionen über die Wiktionary REST API (inkl. automatischer Schwa-Tilgung bei IAST-Eingaben wie `kitāb` -> `किताब`) sowie Direktlinks auf **McGregor (Oxford Hindi-English)**, **Platts (Classical Hindi & Urdu)** (DSAL Chicago) und **Wiktionary**.
- **Erweiterter Sanskrit-Wörterbuch-Hub (`src/providers/monierWilliams.ts`)**: Parallele Abfrage von **Monier-Williams (1899, EN)** und **Böhtlingk Petersburger Wörterbuch (DE)** über den aktiven `csl-apidev/getword.php`-Endpunkt (inkl. IAST-/HK-/Devanāgarī-zu-SLP1-Konvertierung) sowie Direktlinks zu **DCS** und **NWS Halle**.
- **Wörterbuch-Tab (`src/App.vue`, `docs/BENUTZERHANDBUCH.md`)**: Sprachumschalter zwischen Sanskrit und Hindi (automatisch vorbelegt nach aktivem Korpus), Race-Condition-Schutz (`dictSearchSeq`) und aktualisiertes Benutzerhandbuch.

### Plattform- & Backend-Stabilität
- **PWA Service Worker (`public/sw.js`, `src/main.ts`)**: Cache auf `alexis-cache-v2` erhöht, `localhost`/`127.0.0.1` vom Caching ausgenommen und Online-PWA auf Network-First mit Offline-Fallback umgestellt, damit neue Releases ohne manuelles Cache-Leeren erscheinen.

---

## v0.3.2 (2026-11-14)

### Datenintegrität & Kernfunktionen
- **Qualitätsbereinigung `hindi_bolo.json`**: 2 fehlende IAST-Makrons ergänzt (`dīvār`, `bagūlā`) und 10 deutschsprachige POS-Kürzel (`konj`, `ptk`) auf kanonische Codes (`conj`, `part`) normalisiert; Korpus-Audit schließt mit 0 Fehlern und 0 Hinweisen ab.
- **Qualitätsbereinigung `payer_sanskrit.json`**: 12 nachgestellte Genus-Marker (`m.`/`f.`/`n.`) aus `lemma_translit` in das Feld `gender` verschoben, 14 fehlklassifizierte `noun`-Einträge korrigiert (13 Indeklinabilia auf `ind`, `पा` auf `verb`) sowie Markdown-Formatierungen (`**…**`, `\*`) aus 18 Bedeutungsfeldern entfernt.
- **Wortart-Anzeige (`VocabularyExplorer.vue`)**: `formatPosShort` und `formatPosFull` um deutsche Bezeichnungen für `num`, `interj`, `conj`/`konj`, `part`/`ptk` und `ind` ergänzt.

---

## v0.3.1 (2026-11-14)

### Datenintegrität & Kernfunktionen
- **Redaktions- & Validierungs-Pipeline (`scripts/validate_and_import_hindi.py`)**: Lokales CLI-Werkzeug zur Massenprüfung via Free Dictionary API, Genus-/Wortart-Abgleich via Lexicala API mit SQLite-Cache (`scripts/.cache/hindi_lexicon.sqlite`), IAST-Prüfung auf Hindi-Schwa-Tilgung und Nukta-Konsistenz (inkl. optionalem LLM-Check) sowie kontrolliertem `--apply`-Import in `data/corpora/hindi_bolo.json`.
- **Nukta-Bereinigung (`hindi_bolo.json`)**: 8 IAST-Umschriften mit Devanāgarī-Nuktas (`क़`, `ग़`) auf kanonisches `q` / `ġ` korrigiert (`qamīz`, `qālīn`, `bāqī`, `qarīb`, `ġaltī se`, `vaqt`, `vāqaī`, `śauq se`).
- **Dokumentation (`REDAKTIONSWORKFLOW.md`, `CHEATSHEET_REDAKTION.md`, `BENUTZERHANDBUCH.md`)**: Vollständige Dokumentation der Redaktions-Pipeline sowie Aktualisierung des eingebetteten VitePress-Hilfe-Overlays.

### Sicherheit & Sandbox
- **Online-TSV-Import gesperrt (`src/App.vue`)**: Das Einlesen neuer TSV-Wortschätze ist in der öffentlichen Web-App / PWA deaktiviert (`canImportCorpora`), sodass ausschließlich kuratierte, über Git eingespielte Referenz-Korpora online ausgeliefert werden. Die persönlichen Leitner-Boxen (1–5) bleiben lokal im Browser vollständig aktiv.

### Plattform- & Backend-Stabilität
- **`.gitignore`-Härtung**: Lokale SQLite-Caches (`scripts/.cache/`, `*.sqlite`, `*.db`) vom Git-Tracking ausgeschlossen.

---

## v0.3.0 (2026-10-30)

### Datenintegrität & Kernfunktionen
- **Vokabel-Explorer & Listenansicht (`VocabularyExplorer.vue`)**: Dedizierter Arbeitsbereich zum Durchsuchen, Filtern (Band, Lektion, Leitner-Box, Fälligkeit, Wortart), Sortieren und Inspizieren des gesamten Wortschatzes inklusive Deklinations- und Konjugations-Drawer sowie gezieltem Ad-hoc-Training („Auswahl jetzt üben").
- **Bidirektionaler Transliterations-Transformer (`transliteration.ts`)**: Echtzeit-Konvertierung zwischen IAST, Harvard-Kyoto (HK) und Devanāgarī (im Browser via TypeScript-Engine und in Tauri via Rust `vidyut-lipi`) in allen Such- und Eingabefeldern.
- **Lektionsgenauer & gefilterter TSV-Export (`storage.ts`)**: Export ausgewählter Bände, Lektionen oder beliebiger Filteransichten als standardisierte `.tsv`-Datei mit automatischer Bereinigung von Steuerzeichen (`\r`, `\n`, `\t`).
- **Native Sprachausgabe / Web Speech TTS (`speech.ts`)**: Integrierte Devanāgarī-Aussprache (`🔊`-Buttons auf der Lernkarte, im Vokabel-Explorer und im Deklinations-/Konjugations-Drawer sowie Tastaturkürzel `v`) mit gedrosseltem Lerntempo (`rate = 0.88`) und WebKit/Safari-kompatibler `hi-IN`-Fallback-Synchronisation für Sanskrit.
- **Benutzerhandbuch (`docs/BENUTZERHANDBUCH.md`)**: Dokumentation der Local-First-Architektur (Read-Only-Server vs. lokaler Speicher), Datensouveränität, PWA-Aktualisierung, Leitner-Systematik und TSV-Spezifikation.

### Sicherheit & Sandbox
- **Dual-Licensing**: Explizite Trennung zwischen Quellcode (`MIT`) und linguistischen Korpora (`CC-BY-4.0`) in `LICENSE`, `package.json` und `README.md`.
- **Read-Only Server-Architektur**: Vollständige Kapselung nutzereigener Importe und Lernfortschritte im lokalen Browser-/App-Speicher ohne Server-Schreibzugriff.

### Performance & Rendering
- **Vorberechnete Transliterations-Tabellen**: Einmalige Modul-Initialisierung der invertierten Devanāgarī-zu-IAST/HK-Mappings unter Wahrung kanonischer IAST-Zeichen (`ṃ`, `oṃ`).

### Plattform- & Backend-Stabilität
- **Vereinheitlichtes Branding**: Konsistente Bezeichnung „Alexis — Vokabeltrainer" über PWA-Manifest (`public/manifest.json`), Tauri-Konfiguration (`src-tauri/tauri.conf.json`) und Paketmetadaten hinweg.

---

## v0.2.0 (2026-10-25)

### Datenintegrität & Kernfunktionen
- Initiales Release der hybriden Vue 3 / Tauri v2 Architektur mit Leitner-5-Boxen-SRS, integriertem Kurs *Hindi bolo* (Bände 1 & 2, 1.564 Vokabeln), Payer-Sanskrit-Kurs und Monier-Williams-Wörterbuchanbindung.
