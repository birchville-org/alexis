# Alexis — Usability-Roadmap & Konzeptioneller Vergleich mit Anki

> **Philosophie:** Maximaler Lerneffekt durch philologische Präzision und minimale kognitive Reibung (*Zero-Config Local-First*).

---

## 1. Ausgangslage: Warum Alexis statt Anki?

Anki ist ein bewährtes, generisches Karteikartenprogramm, erzeugt jedoch im Lernalltag erhebliche Usability-Hürden:

1. **Konfigurations-Überlastung (*Cognitive Overhead*)**:
   - Dutzende Parameter (*Ease Factor*, *Interval Modifier*, *Leech Thresholds*, *Lapse Steps*).
   - Lernende verbringen viel Zeit mit der Programmverwaltung statt mit dem eigentlichen Vokabellernen.
2. **Karten-Frustration (*Ease Hell*)**:
   - Häufiges Bewerten mit „Nochmal“ drückt den *Ease Factor* unbarmherzig nach unten, sodass dieselben Karten übermäßig oft vorgelegt werden und Frustration erzeugen.
   - Nach einer Lernpause droht ein unüberwindlicher „Kartenberg“ (z. B. 500 fällige Karten).
3. **Mangelnde Übersicht & starre Deck-Strukturen**:
   - Wer gezielt nur *„Lektion 1 und 2 vor der Klausur durchgehen“* möchte, muss in Anki umständlich gefilterte Decks (*Filtered Decks*) mit komplexer Suchsyntax anlegen.
   - Es gibt keine einfache, strukturierte Listenansicht, um Vokabeln einer Lektion vorab im Zusammenhang zu überfliegen.
4. **Fehlende philologische & linguistische Intelligenz**:
   - Für indologische und orientalische Sprachen (Hindi, Sanskrit) bietet Anki keinerlei morphologisches Verständnis. Deklinationstabellen, Verbstämme, Ergativ-Syntax (*ne*) und IAST-Transliterationen müssen manuell aufwendig eingetippt oder per HTML-Code gebaut werden.

---

## 2. Der Alexis-Ansatz (Usability-Prinzipien)

| Dimension | Anki | Alexis-Standard |
| :--- | :--- | :--- |
| **Setup & Plattform** | Desktop-Installation + separater Web-Account. | **Zero-Config PWA**: Sofortige Nutzung im Browser per URL, 100% offline-fähig (Local-First mit IndexedDB). |
| **Deck- & Lektionswahl** | Verschachtelte Decks/Subdecks. | **Flexible Multi-Selektion**: Bände und Lektionen mit einem Klick per Checkbox auswählen. |
| **Lernrichtung** | Erfordert separate Kartentypen (*Reversed Cards*), verdoppelt Datenbankeinträge. | **Dynamische Inversion**: Taste `r` oder Schalter `⇄` wechselt die Richtung on-the-fly ohne Kartendopplung. |
| **Reihenfolge** | In Deck-Einstellungen vergraben. | **Direktwahl**: Umschalter `🔀 Zufall / Alphabetisch` (Taste `s`) jederzeit verfügbar. |
| **Grammatik & Morphologie** | Reiner Freitext. | **Automatisierte Paradigmen**: Generiert vollständige Deklinationstabellen, Verbstämme, Ergativ-Regeln und Umschrift. |
| **Spaced Repetition** | SM-2 / FSRS mit Dutzenden Variablen. | **5-Boxen-Leitner-System**: Transparente, feste Intervalle (1, 3, 7, 14, 30 Tage) mit 4 Tasten (1–4) – berechenbar und stressfrei. |
| **Datenimport** | Komplexes CSV-Feld-Mapping. | **1-Klick TSV-Import**: Automatische Spalten-, Band- und Lektionserkennung per Drag & Drop. |

---

## 3. Ausbaustufen (Roadmap)

### Phase 1: Vokabel-Explorer & Listenansicht (In Vorbereitung)
- **Problem**: Beim reinen Kartenlernen fehlt der Überblick über den Gesamtkontext einer Lektion.
- **Lösung**: Ein übersichtlicher Reiter oder Slide-Over *Vokabelliste*:
  - Tabellarische Gesamtschau aller Vokabeln der gewählten Lektionen (Devanagari, IAST, Genus, deutsche Bedeutung, Tags).
  - Echtzeit-Filter und Volltextsuche.
  - Ermöglicht das rasche Vorab-Durchlesen oder Wiederholen vor einer Prüfung ohne Bewertungszwang.

### Phase 2: Native Sprachausgabe (Web Speech API)
- **Problem**: Aussprache von Hindi-Wörtern (z. B. Aspirationen, retroflexe Laute wie *ṭ/ḍ*) ist aus reinem Text schwer abrufbar. Externe Audiodateien erfordern viel Speicher und Setup.
- **Lösung**: Audio-Button 🔊 auf der Karte und Tastaturkürzel `v`:
  - Nutzt die moderne, offline verfügbare Browser-Sprachsynthese (`lang: "hi-IN"`).
  - Keine externen MP3-Dateien oder Serverabrufe nötig.

### Phase 3: Session-Recap (Fehlkarten sofort festigen)
- **Problem**: Bei Anki werden Fehlkarten in sogenannte *Relearn Steps* gesteckt, die den Lernfluss unterbrechen.
- **Lösung**: Am Ende eines Lernstapels erscheint eine klare Zusammenfassung:
  - *„15 Karten gelernt, 3 Karten mit 'Nochmal' bewertet.“*
  - 1-Klick-Aktion: *„Diese 3 Fehlkarten jetzt nochmals festigen?“*

### Phase 4: Favoriten & Prüfungs-Merkliste (★)
- **Problem**: Oft möchte man gezielt 10 bis 20 besonders schwierige Vokabeln markieren.
- **Lösung**: Stern-Icon ★ auf der Karte (Taste `f` für *Favorite*):
  - Schnelle Filterung in der Gliederungsauswahl: *„Nur markierte Vokabeln (★) lernen“*.

### Phase 5: Optionales Tastatur-Schrifttraining
- **Problem**: Passive Wiedererkennung reicht oft nicht aus, um die Schrift aktiv reproduzieren zu können.
- **Lösung**: Zuschaltbarer Modus *„Tippen statt nur Aufdecken“*:
  - Bei der Richtung *Deutsch ➔ Hindi* erscheint ein Eingabefeld (IAST oder Devanagari).
  - Sofortiges visuelles Feedback beim Drücken der Eingabetaste. Wer nicht tippen will, nutzt weiterhin die Leertaste zum Aufdecken.
