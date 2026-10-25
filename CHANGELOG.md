# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [v0.2.0] - 2026-10-25

### Datenintegrität & Kernfunktionen
- **Umkehrbare Lernrichtung (Hindi/Sanskrit ⇄ Deutsch)**: Abfrage in beiden Richtungen mit Tastaturkürzel `r` bzw. Richtungsumschalter. Beim Abfragen von Deutsch nach Zielsprache wird das Genus beim Aufdecken verifiziert.
- **Zufallswiedergabe (Shuffle)**: Unterstützung von Fisher-Yates-Zufallsmischung im Browser und SQLite `ORDER BY RANDOM()` im Rust-Backend mit Tastaturkürzel `s`.
- **Hindi Substantiv-Deklinationstabelle**: Automatische morphologische Paradigmenanalyse (Direktus, Obliquus, Vokativ) für Maskulina und Feminina aller Stammklassen mit Postpositionsrektions-Hinweisen.
- **Hindi Verb-Paradigmen & Ergativ-Syntax**: Anzeige der Ergativregel `[+ne]` / `[-ne]`, Stammformen, unregelmäßiger Perfektpartizipien (*huā*, *gayā*, *kiyā*, *piyā* etc.), Habitualis, Futur und dreistufiger Imperativformen.
- **Payer Sanskrit Synthese**: Vollständige Fusion aus `glossar.md` und Lektionswortlisten zu 880 verifizierten Sanskrit-Lemmata, aufgeteilt in drei TSV-Bände (L1–20, L21–40, L41–61).
- **TSV-Runtime-Import & IndexedDB-Persistenz**: Hochladen beliebiger UTF-8 TSV-Vokabellisten mit automatischer Gliederungs- und Lektionserkennung und dauerhafter Speicherung im Browser.

### Sicherheit & Sandbox
- **Lokale Datenhaltung**: Reines Local-First-Prinzip ohne Backend-Server; alle Lernstände und importierten Korpora verbleiben lokal in IndexedDB / SQLite.
- **HTML-Escaping**: Strikte Absicherung aller dynamischen Template-Ausdrücke gegen XSS.

### Performance & Rendering
- **Typografie ohne verwaiste Diakritika**: Beseitigung isolierter Devanagari-Mātrās und Dotted Circles (`◌`) durch kanonische freistehende Vokalzeichen (*-एं*, *-ओं*).
- **Birchville Scholarly Synthesis**: Responsives Layout nach Birchville-Standard mit Light Mode (Warm Ivory & Deep Ink) und Dark Mode.

### Plattform- & Backend-Stabilität
- **Race-Condition-Schutz**: Asynchrone Initialisierungsbarriere (`ensureInitialized`) für IndexedDB beim Kaltstart des Browsers.
- **Referenzentkopplung**: Klonen von Definitions- und Tag-Arrays zur Vermeidung von State-Mutationen im In-Memory-Bundle-Cache.
- **Tauri v2 & GitHub Pages**: Unterstützung sowohl als native Desktop-Applikation als auch als statisch gehostete Webapp/PWA.
