# Release Notes — Alexis (Ἀλέξις / Lexis)

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
