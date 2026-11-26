# Release Notes — Alexis (Ἀλέξις / Lexis)

## v0.6.6 (2026-11-26)

### Datenintegrität & Kernfunktionen
- **Lernstand-Backup-Meccano (`alexis-backup-v2`) & Desktop/PWA-Parität (`src/components/BackupMeccano.vue`, `src/services/storage.ts`, `src-tauri/src/db.rs`, `src-tauri/src/lib.rs`, `src/App.vue`)**: Einheitliche Backup-Komponente im Modal *Offline / Download*, in *Hilfe Kapitel 1* und im Reiter *Statistik* mit Anzeige des letzten lokalen Backups, Alterspille und 1-Klick-Sicherung/Wiederherstellung. Sichert `study_state` (inkl. `reviewCount`, `userNote`, normalisierten UTC-ISO-`nextDue`), `entry_overrides` und `custom_corpora` identisch in PWA (`IndexedDB`) und Desktop-App (`SQLite` über `export_corpus_bundles` und `import_study_state`). Vor dem Einspielen prüft `inspectStudyBackup` das Schema (abwärtskompatibel zu v1, lehnt Gutachter-Deltas und Korpus-JSONs ab) mit Bestätigungsdialog, spielt Custom-Korpora als reines Delta ein und bewahrt vorhandene lokale Notizen (`COALESCE`-Parität).
- **5-Fächer-Leitner-Darstellung mit Live-Zielvorschau & aufgeschlüsselter Statistik (`src/App.vue`, `docs/BENUTZERHANDBUCH.md`, `docs/ARCHITECTURE.md`)**: Direkt über den 4 Bewertungstasten auf der Kartenrückseite zeigt eine 5-Fächer-Leiste (`Box 1`–`Box 5`) die aktuelle Box und hebt beim Überfahren/Fokussieren einer Taste das Zielfach samt Wartezeit hervor; die Tasten-Untertitel zeigen dynamisch Ziel-Box und reales Intervall (auch in Box 5 ohne irreführendes `+1 Box`). Im Reiter *Statistik* stehen die 2 Übersichtskennzahlen (*Gesamte Vokabeln*, *Heute fällig*) über einer eigenen 5er-Zeile für `Box 1` bis `Box 5`.

---

## v0.6.5 (2026-11-25)

### Datenintegrität & Kernfunktionen
- **Zweistufiges Notizsystem — TSV-Spalte `notes` & persönliche Lernnotiz (`user_note`) (`src/types/index.ts`, `src/services/storage.ts`, `src-tauri/src/db.rs`, `src-tauri/src/lib.rs`, `src/App.vue`, `src/components/VocabularyExplorer.vue`, `scripts/validate_and_import_hindi.py`)**: Rückwärtskompatible optionale 9. TSV-Spalte `notes` für kuratierte Hinweise (Anki- und 8-Spalten-TSV-kompatibel) sowie geräte-lokales Freitextfeld `user_note` (Shortcut `n` / `+ Persönliche Notiz (N)` auf der aufgedeckten Karte sowie im Detail-Modal des Vokabel-Explorers, gespeichert in `IndexedDB` und `SQLite` inkl. idempotenter `ALTER TABLE`-Migration, enthalten in JSON-Backups und TSV-Export).
- **Einzelwort-Editor, PWA-Lokal-Editierung & Entwicklungs-`Git-Sync` (`src/components/VocabularyExplorer.vue`, `src/services/storage.ts`, `vite.config.ts`)**: Im Detail-Modal lassen sich über `✏️ Eintrag bearbeiten` Devanāgarī, IAST, Wortart, Genus, deutsche Bedeutungen, Spalte `notes` und Tags direkt pflegen. Desktop-App (`SQLite`) und installierte PWA (`IndexedDB` v3 `entry_overrides` + kollisionssichere `usr_`-IDs für Importe) speichern lokal ohne Server-Updates zu blockieren; auf dem lokalen Vite-Entwicklungsserver (`localhost:5180`) schreiben Änderungen direkt Biome-formatiert in `data/corpora/*.json`.
- **Externer Gutachter-Modus & Delta-Workflow (`?review=1`) (`src/App.vue`, `src/components/VocabularyExplorer.vue`, `src/services/storage.ts`)**: `?review=1` öffnet den Vokabel-Explorer mit lokal vorgemerkten Änderungen, Gutachter-Kommentarfeld und 1-Klick-Export im kompakten Schema `alexis-review-delta-v1` (`📤 Korrektur-Delta herunterladen (.json)`); die Redaktion prüft und übernimmt Deltas selektiv über `📥 Delta prüfen`.
- **Korpus-Korrekturen & schärferes Hindi-Audit (`data/corpora/hindi_bolo.json`, `src/services/corpusAudit.ts`)**: Zwei Tippfehler in `Hindi bolo 1`, Lektion 2 (`करोड़` -> `zehn Millionen`, `दस` -> `zehn`) korrigiert; `auditHindiEntry` akzeptiert `ind` als kompatibel mit `adv`, `part`, `conj`, `interj`, `postp` und überspringt die Wiktionary-Einzelartikel-Suche bei Mehrwort-Wendungen.
- **Dokumentation nachgezogen (`docs/`)**: `BENUTZERHANDBUCH.md`, `CHEATSHEET_REDAKTION.md`, `REDAKTIONSWORKFLOW.md`, `ARCHITECTURE.md` und `ROADMAP.md` (plus In-App-Hilfe) auf 9-Spalten-TSV, 3-Modi-Rollentrennung und Delta-Review aktualisiert.

### Sicherheit & Sandbox
- **Server-Read-Only-Härtung & Dev-CSRF-Schutz (`src/App.vue`, `src/components/VocabularyExplorer.vue`, `vite.config.ts`)**: Reine Browser-/Server-Ansichten (inkl. Simulation via `?readonly=1`) blenden `🔎 Online prüfen`, Einzelwort-Editor und TSV-Import konsequent aus und verweisen auf PWA/Desktop-App. Der ausschließlich im lokalen Vite-Dev-Server aktive Redaktions-Sync-Endpunkt erzwingt `POST`, Loopback-Adresse, `X-Alexis-Dev: 1`, `Content-Type: application/json`, lokalen `Host`/`Origin` sowie Bundle-Schema-Validierung und ist nicht im Produktions-Build enthalten.

### Plattform- & Backend-Stabilität
- **TDZ-Fix beim Karten-Watcher (`src/App.vue`)**: `currentCard`-Computed vor dem Notiz-Editor-`watch` initialisiert (`ReferenceError: Cannot access 'currentCard' before initialization` behoben).

---

## v0.6.4 (2026-11-24)

### Datenintegrität & Kernfunktionen
- **Wörterbuch-Transliterations-Toggles (`IAST ⇄ देव` & `HK ⇄ देव`) (`src/App.vue`)**: Zwei kompakte Umwandlungs-Buttons über dem Suchfeld des Wörterbuch-Hubs (nach ZenTauri-Vorbild) samt Tastenkürzeln `⌥⌘D` / `Ctrl+Alt+D` (IAST ⇄ Devanāgarī) und `⌥⌘H` / `Ctrl+Alt+H` (Harvard-Kyoto ⇄ Devanāgarī). Unterstützt sowohl Teilmarkierungen als auch das gesamte Eingabefeld inkl. sprachabhängiger Hindi-Schwa-Tilgung am Wortende.

---

## v0.6.3 (2026-11-23)

### Plattform- & Backend-Stabilität
- **Blank-Page-Selbstheilung nach Deployments (`index.html`, `src/main.ts`)**: Inline-Fehlerfänger im `<head>` (vor den Vite-Asset-Tags) sowie `vite:preloadError`-Handler erkennen fehlgeschlagene `/assets/`-Skripte/Stylesheets nach veraltetem Cache, deregistrieren alte Service Worker, leeren `caches` und laden die Seite einmalig neu (`sessionStorage`-Guard gegen Reload-Schleifen).
- **Service-Worker-Caching gehärtet (`public/sw.js`, `src/main.ts`)**: Cache auf `alexis-cache-v4` aktualisiert, Service-Worker-Registrierung auf `{ updateViaCache: "none" }` mit `reg.update()` umgestellt und Navigationsanfragen über `fetch(event.request.url, { cache: "no-cache" })` revalidiert.

---

## v0.6.2 (2026-11-18)

### Datenintegrität & Kernfunktionen
- **DSAL-Volltextsuche für Hindi (McGregor & Platts) (`src/providers/hindiDictionary.ts`, `src/services/corpusAudit.ts`)**: `searchhws=yes` (Beschränkung auf Hauptlemmata) durch `matchtype=default` ersetzt, sodass auch Untereinträge wie `नमस्ते` (unter `नमस` im McGregor) sowie Wendungen direkt gefunden werden.
- **Dynamische Versionsanzeige in der Hilfe (`src/App.vue`)**: Der Footer der Hilfe-Seitenleiste bindet nun `appVersion` direkt aus `package.json` statt eines statischen Versionsstrings.
- **Roadmap-Meilensteine `v1.0` vs. `v2.0` (`docs/ROADMAP.md`)**: Abgrenzung der Indologie-Stabilisierung (Hindi & Sanskrit bis `v1.0`) von der Multi-Language-Erweiterung (`grc`, `fr`, `it`, `en`, `rm` und Desktop-Korpusanlage ab `v2.0`).

---

## v0.6.1 (2026-11-17)

### Datenintegrität & Kernfunktionen
- **Automatisches SQLite-Seeding für die Desktop-App (`src/services/storage.ts`)**: Bei einer frisch angelegten oder noch leeren lokalen `alexis.db` spielt `listCorpora()` beim App-Start automatisch die eingebetteten Standard-Korpora (`hindi-bolo`, `payer-sanskrit`) einmalig in SQLite ein; zudem hält `updateEntries()` den In-Memory-Stand in `memoryBundles` synchron.
- **Natives Desktop-Menü & Hilfe-Kapitel 9 (`src-tauri/src/lib.rs`, `src/App.vue`)**: Menüleiste mit `File` (TSV-Import, TSV-Export, JSON-Backup), `View` (`Cmd+1`–`5`, Dark/Light, Richtung, Shuffle) und `Help` (`Benutzerhandbuch`, `Updates & Release Notes`, `Check for Updates...`) sowie neuem Hilfe-Kapitel `9. Updates & Release Notes` inkl. eingebetteter Versionshistorie.
- **Präzisierte 3 Use Cases (`src/App.vue`, `docs/BENUTZERHANDBUCH.md`)**: Klare Gegenüberstellung von Use Case 1 (Browser online), Use Case 2 (PWA offline mit Server-Updates auf Programm & Standard-Wortbestand) und Use Case 3 (Desktop-App für lokale Wortbestands-Pflege).

---

## v0.6.0 (2026-11-17)

### Datenintegrität & Kernfunktionen
- **Online-Wörterbuchprüfung & Freigabe-Korrektur (`src/services/corpusAudit.ts`, `VocabularyExplorer.vue`)**: Im Vokabel-Explorer prüft `🔎 Online prüfen` die aktive Liste gegen Wiktionary (Hindi: Existenz, Wortart, IAST-Langvokale & Nuktas) bzw. Cologne Monier-Williams (Sanskrit: Existenz, IAST-Umschrift & fehlendes Genus). Befunde erscheinen im Popup-Fenster mit Vorschlägen (`Alt -> Neu`), Direktlinks und Freigabe-Button (`✓ Freigeben & Korrekturen anwenden`) für SQLite (`update_corpus_entries`) und `IndexedDB`.
- **Eigenes Alexis-Logo (`public/alexis_logo.png`, `src-tauri/icons/`)**: Neues Leitner-Codex-Emblem mit Devanāgarī **अ** (links) und griechischem **Ω** (rechts) für Favicon, PWA-Manifest, Header und alle Desktop-/App-Icons.
- **Präzisierte 3 Betriebsarten (`src/App.vue`, `docs/BENUTZERHANDBUCH.md`)**: Klare Nummerierung 1. Browser (online), 2. Browser-PWA (installiert, offline mit Server-Updates) und 3. Desktop-App (offline, einzige Betriebsart für eigenen Vokabelbestand).

### Plattform- & Backend-Stabilität
- **PWA Service Worker (`public/sw.js`)**: Cache auf `alexis-cache-v3` (inkl. `alexis_logo.png`) aktualisiert.

---

## v0.5.1 (2026-11-17)

### Datenintegrität & Kernfunktionen
- **Platts (DSAL) IAST-Abfrage & Schwa-Tilgung (`src/providers/hindiDictionary.ts`)**: Platts erhält ab sofort IAST-Suchbegriffe (inkl. Schwa-Tilgung am Wortende bei Devanāgarī-Eingaben wie `किताब` -> `kitāb`), sodass persisch-arabische und klassische Hindi/Urdu-Lemmata direkt gefunden werden.
- **NWS Halle Direktsuche (`src/providers/monierWilliams.ts`)**: Übergibt den Suchbegriff in Harvard-Kyoto direkt an `https://nws.uzi.uni-halle.de/search?q=...&lang=de`.
- **Betriebsarten- & Desktop-Download-Hinweise (`src/App.vue`)**: Verweis auf die 3 Betriebsarten (Browser, Browser-PWA, Desktop-App) und Direktlink zur Desktop-Release-Seite im Offline-/Download-Modal, unter *Korpora & Gliederung* (bei deaktiviertem Online-Import) und im Hilfe-Modal.

---

## v0.5.0 (2026-11-16)

### Datenintegrität & Kernfunktionen
- **Desktop-Auto-Updater (`src/services/updater.ts`, `tauri-plugin-updater`)**: Automatische Update-Prüfung 4 Sekunden nach App-Start sowie manuelle Prüfung im Offline-/Download-Modal (`🔄 Nach Updates suchen`) mit signierten Paketen über `latest.json` unter vollständigem Erhalt der lokalen SQLite-Datenbank (`alexis.db`).
- **Sichtbarer Betriebsmodus-Indikator (`src/App.vue`, `docs/BENUTZERHANDBUCH.md`)**: Unter *Korpora & Gliederung* und im Offline-/Download-Modal wird nun transparent angezeigt, ob Alexis als *Browser / PWA (Wortschatz Read-Only)* oder *Desktop-App (SQLite Read-Write)* läuft; das Benutzerhandbuch stellt klar, dass eigene TSV-Kuration die Desktop-App erfordert.

### Plattform- & Backend-Stabilität
- **Multi-Plattform Desktop-CI (`.github/workflows/release-desktop.yml`)**: Automatisierter Build und Signierung für macOS (`universal-apple-darwin` `.dmg`/`.app`), Windows (`.msi`/`.exe`) und Linux (`.AppImage`/`.deb`) inklusive konsolidiertem `latest.json`-Updater-Manifest.

---

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
