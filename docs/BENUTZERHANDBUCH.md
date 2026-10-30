# Alexis — Benutzerhandbuch

> **Alexis** ist ein offline-fähiger, datensouveräner Vokabeltrainer, Korpus-Reader und Wörterbuch-Hub für moderne und klassische Sprachen (Hindi, Sanskrit).

---

## 1. Philosophie & Architektur: Datensouveränität (Local-First)

Alexis unterscheidet sich grundlegend von herkömmlichen Vokabel-Cloud-Diensten durch das Prinzip **Zero-Config Local-First**:

### 1.1 Der Server als schreibgeschützte Basis (Read-Only)
- **Kanonischer Datenbestand**: Die auf GitHub Pages bereitgestellte Web-App dient als statische Verteilungsbasis. Sie liefert den Programmcode und die verifizierten Kern-Wörterbücher (*Hindi bolo*, *Sanskritkurs Alois Payer*).
- **Strikter Schreibschutz**: GitHub Pages ist ein rein statischer Webserver ohne Datenbank und ohne Schreib-API. Ein Browser-Client oder eine PWA besitzt technisch keinerlei Möglichkeit, Dateien auf dem Server zu überschreiben, zu löschen oder zu verändern.
- **Inhaber-Kuration**: Neue offizielle Wörterbücher oder Korrekturen am Lehrwerk können ausschließlich vom Inhaber des Git-Repositories über authentifizierte Commits (`git push`) eingespielt werden.

### 1.2 Lokale Datenspeicherung & Datenschutz
- **100 % lokal auf dem Endgerät**: Wenn Sie in Alexis eigene TSV-Dateien importieren, Vokabeln lernen oder Notizen anlegen, werden diese Daten ausschließlich in der internen Datenbank Ihres Browsers (`IndexedDB`) bzw. bei der Desktop-App in einer lokalen SQLite-Datei gespeichert.
- **Keine Server-Synchronisation**: Es werden keinerlei persönliche Lerndaten, Lernstände, Zeitstempel oder selbsterstellte Wortschätze an einen Server übertragen. Sie behalten die uneingeschränkte Kontrolle über Ihre Daten.

### 1.3 Automatische Programm-Updates
- Sobald Ihr Endgerät mit dem Internet verbunden ist, prüft der Service Worker im Hintergrund, ob auf dem Server eine neuere Version von Alexis vorliegt.
- Bei einem Update werden der Programmcode und allfällige Korrekturen an den kanonischen Wörterbüchern im Cache aktualisiert.
- **Ihre persönlichen Lernfortschritte** (in welcher Box eine Karte liegt, Fälligkeitsdaten, selbsterstellte Vokabellisten) bleiben dabei vollständig erhalten, da sie getrennt vom Programmcode in Ihrer lokalen Datenbank abgelegt sind.

### 1.4 Handhabung eigener Wörterverzeichnisse
- **Warum kein automatisches Teilen?** Viele Lernende erfassen Wortschätze aus urheberrechtlich geschützten Lehrbüchern. Ein automatisches Hochladen auf einen Server würde rechtliche Probleme aufwerfen, Datenschutzvereinbarungen erfordern und zu unkontrolliertem Datenwildwuchs führen.
- **Souveräner Peer-to-Peer-Austausch**: Wenn Sie selbsterstellte Lektionen mit anderen teilen möchten, nutzen Sie die integrierte TSV-Export-Funktion. Sie erhalten eine saubere Textdatei (`.tsv`), die Sie per E-Mail, Messenger oder USB-Stick weitergeben können.
- **Kuratierter Beitrag**: Haben Sie ein vollständiges gemeinfreies oder lizenziertes Werk erarbeitet, kann dieses dem Repository-Inhaber per GitHub Pull Request oder Issue zur offiziellen Aufnahme vorgeschlagen werden.

---

## 2. Der Trainer (Lernkarten & Leitner-System)

Der Trainer setzt auf ein didaktisch klares, stressfreies **5-Boxen-Leitner-System** mit festen Intervallen:

| Box | Zeitintervall bis zur Wiedervorlage |
| :--- | :--- |
| **Box 1** | Täglich (1 Tag) |
| **Box 2** | Nach 3 Tagen |
| **Box 3** | Nach 7 Tagen (1 Woche) |
| **Box 4** | Nach 14 Tagen (2 Wochen) |
| **Box 5** | Nach 30 Tagen (1 Monat) — *Dauergedächtnis* |

### Die 4 Bewertungstasten
Nach dem Aufdecken der Karte stehen 4 Bewertungen zur Verfügung:
1. **Taste 1 (Nochmal):** Die Karte fällt sofort in **Box 1** zurück (Intervall: 1 Tag).
2. **Taste 2 (Schwer):** Die Karte bleibt in der aktuellen Box (Intervall: 1 Tag zur Wiederholung).
3. **Taste 3 (Gut / 2x Leertaste):** Die Karte steigt um **+1 Box auf** (z. B. Box 1 ➔ Box 2: 3 Tage).
4. **Taste 4 (Einfach):** Die Karte steigt um **+1 Box auf mit Bonussprung** (z. B. Box 1 ➔ Box 2: 5 Tage).

### Dynamische Steuerung
- **Richtungsumkehr (Taste `r` oder Schalter `⇄`):** Schaltet jederzeit zwischen *Zielsprache ➔ Deutsch* (Verständnis) und *Deutsch ➔ Zielsprache* (aktive Reproduktion inkl. Geschlechts-Abfrage) um, ohne Kartendopplungen zu erzeugen.
- **Reihenfolge (Taste `s` oder Schalter `🔀`):** Wechselt zwischen curricularem/alphabetischem Ablauf und Zufallsmodus (*Shuffle*).
- **Sprachausgabe (Taste `v` oder Button `🔊`):** Liest die aktuelle Vokabel über die native Sprachengine des Betriebssystems vor.
- **Grammatik-Schublade (Taste `g`):** Klappt bei flektierbaren Wörtern die Deklinationstabelle oder Verbstämme mit Hinweisen zur Ergativ-Syntax (*ne*) auf.
- **Umschrift (Taste `u` oder `t`):** Blendet die wissenschaftliche IAST-Transliteration ein oder aus.

### 2.1 Technische Architektur der Sprachausgabe (W3C Web Speech API)
Für die Vertonung der Vokabeln (`src/services/speech.ts`) nutzt Alexis den **W3C Web Speech API Standard** (`window.speechSynthesis` / `SpeechSynthesisUtterance`):

- **Kein externer Cloud-Dienst / kein API-Schlüssel:** Es werden keine Wörter an kostenpflichtige Drittanbieter-Server gesendet. Alexis greift direkt auf die im jeweiligen Betriebssystem bzw. Browser lokal installierten Text-to-Speech-Stimmen (TTS) zu und funktioniert damit auch offline.
- **Verwendete Systemstimmen nach Plattform (Prioritätsreihenfolge):**
  1. **macOS & iOS (Safari, Tauri Desktop, Chrome):** Apples Systemstimme **„Lekha"** (`hi-IN`). Für maximale Klangqualität kann in den macOS-/iOS-Systemeinstellungen unter *Bedienungshilfen ➔ Gesprochener Inhalt ➔ Systemstimme ➔ Stimme verwalten ➔ Hindi* das Paket **„Lekha (Erweitert)"** bzw. **„Lekha (Premium)"** kostenfrei nachgeladen werden.
  2. **Desktop Google Chrome:** `Google हिन्दी` (`hi-IN`).
  3. **Windows 10/11 (Edge, Chrome, Tauri Desktop):** Microsofts Systemstimmen **„Microsoft Swara"** oder **„Microsoft Hemant"** (`hi-IN`).
  4. **Android:** **Google Speech Recognition & Synthesis** (`hi-IN` / `sa-IN`).
- **Phonetische Artikulation & Sanskrit-Fallback:**
  - Da Devanāgarī weitgehend phonematisch geschrieben wird, bildet die Übergabe des Original-Devanāgarī-Lemmas Aspiration (`ख`, `घ`, `छ`, `ध`, `फ`, `भ`), Retroflexe (`ट`, `ठ`, `ड`, `ढ`, `ण`) und Vokallängen zuverlässig ab.
  - Das Sprechtempo ist standardmäßig leicht gedrosselt (`rate = 0.88`), damit Konsonantencluster und Aspiraten im Lernbetrieb klar unterscheidbar bleiben.
  - Falls auf einem Endgerät keine dedizierte Sanskrit-Stimme (`sa-IN`) installiert ist, fällt Alexis automatisch und ohne Stummschaltung auf die installierte Hindi-Devanāgarī-Stimme (`hi-IN`) zurück.

---

## 3. Vokabelliste & Vokabel-Explorer

Der Reiter **Vokabelliste** bietet eine vollständige tabellarische Übersicht über den Vokabelbestand, ohne dass ein Bewertungszwang besteht:

- **Echtzeit-Volltextsuche mit Transliterations-Transformer:**
  - Erkennt Eingaben in Devanāgarī, IAST oder Harvard-Kyoto (`kRSNa` ➔ findet `कृष्ण` und `kṛṣṇa`).
  - Der Button **`अ ⇄ a`** im Suchfeld konvertiert den Suchbegriff auf Knopfdruck zwischen Schrift und Umschrift.
- **Filter-Leiste:**
  - *Umfang:* Aktuelle Gliederungsauswahl vs. gesamtes Korpus.
  - *Band & Lektion:* Gezielte Eingrenzung auf bestimmte Kapitel.
  - *Box / Status:* Nur Vokabeln einer bestimmten Box (1–5) oder nur heute fällige Karten anzeigen.
  - *Wortart:* Filterung nach Substantiven, Verben, Adjektiven oder anderen Wortarten.
- **Aktionen:**
  - **`▶️ Diese Auswahl im Trainer üben`:** Übergibt exakt die gefilterte Liste an den Trainer, um sofort eine maßgeschneiderte Lerneinheit zu starten.
  - **`📥 TSV herunterladen`:** Speichert den gefilterten Datenbestand als `.tsv`-Datei.
  - **`📋 Als TSV kopieren`:** Kopiert die Tabelle für Tabellenkalkulationen in die Zwischenablage.
  - **`🔊` in jeder Zeile:** Sofortige Audio-Aussprache des Eintrags.

---

## 4. Korpora & Gliederungen (Verwaltung & Export)

Im Reiter **Korpora & Gliederung** bestimmen Sie, welche Lehrwerke und Lektionen aktiv gelernt werden:

- **Multi-Selektion:** Wählen Sie durch einfaches Anhaken einzelne oder mehrere Bände und Lektionen aus.
- **Lektions-Export (`📥 TSV`):** Jede Lektion verfügt über einen separaten Export-Button, um den Wortschatz als strukturierte Textdatei zu sichern.
- **Sammel-Export:** Über *„📥 Gewählte als TSV exportieren“* können mehrere markierte Lektionen in einer Datei zusammengefasst heruntergeladen werden.
- **Eigene TSV-Dateien importieren:** Laden Sie eigene Wortschatzlisten per Drag & Drop oder Dateidialog hoch.

---

## 5. Wörterbuch-Hub (Monier-Williams)

Der Reiter **Wörterbuch (MW)** bindet das maßgebliche *Monier-Williams Sanskrit-English Dictionary* an:
- Direkte Volltext- und Stichwortsuche über die REST-Schnittstelle der *Cologne Digital Sanskrit Dictionaries*.
- Automatische Erkennung und Normalisierung von IAST, Harvard-Kyoto und Devanāgarī.

---

## 6. Offline-Nutzung & Datensicherung

Über die Schaltfläche **💾 Offline / Download** in der Kopfzeile:
- **PWA-Installation:** Installation als eigenständige Desktop- oder Mobile-App (funktioniert ohne Internetverbindung).
- **Lernstand-Backup (`.json`):** Sichert sämtliche Box-Zuordnungen, Wiederholungszähler und Fälligkeitsdaten in einer portablen JSON-Datei.
- **Korpus-Download:** Lädt den vollständigen Rohdatenbestand des aktiven Lehrwerks herunter.

---

## 7. Tastaturkürzel-Referenz

| Taste | Funktion |
| :--- | :--- |
| `Leertaste` / `Enter` | Karte aufdecken (Vorderseite ➔ Rückseite) |
| `Leertaste` (aufgedeckt) | Schnellbewertung mit „Gut“ (+1 Box) |
| `1` | Bewertung: **Nochmal** (Rückfall auf Box 1) |
| `2` | Bewertung: **Schwer** (Bleibt in aktueller Box, 1 Tag) |
| `3` | Bewertung: **Gut** (Aufstieg +1 Box) |
| `4` | Bewertung: **Einfach** (Aufstieg +1 Box mit Bonusintervall) |
| `v` | **Aussprache anhören** (Sprachausgabe TTS) 🔊 |
| `r` | **Lernrichtung umkehren** (Zielsprache ⇄ Deutsch) |
| `s` | **Reihenfolge umschalten** (Zufall / Shuffle ⇄ Curricular) |
| `g` | **Grammatik / Paradigma** ein- oder ausklappen |
| `u` / `t` | **Umschrift (IAST)** ein- oder ausblenden |

---

## 8. TSV-Importspezifikation

Eigene Wortschatzlisten müssen als Tabstopp-getrennte Textdateien (UTF-8, `.tsv` oder `.txt`) formatiert sein. Die erste Zeile muss folgende Spaltenüberschriften tragen:

```tsv
volume	lesson	native	transliteration	pos	gender	meaning_de	tags
hb1	1	अच्छा	acchā	adj	-	gut; ach so!	adjektive;begruessung
hb1	1	किताब	kitāb	noun	f	Buch	substantive
```

- **volume:** Band-Kennung (z. B. `hb1`, `payer_vol1`).
- **lesson:** Lektionsnummer (Ganzzahl, z. B. `1`, `2`).
- **native:** Wort in Originalschrift (z. B. Devanāgarī).
- **transliteration:** Wissenschaftliche Umschrift (IAST).
- **pos:** Wortart (`noun`, `verb`, `adj`, `adv`, `pron`, `postp`, `ind`).
- **gender:** Grammatisches Geschlecht (`m`, `f`, `n`, `m/f` oder `-`).
- **meaning_de:** Deutsche Bedeutung (mehrere Bedeutungen durch Semikolon trennen).
- **tags:** Optionale Schlagworte, durch Semikolon getrennt.
