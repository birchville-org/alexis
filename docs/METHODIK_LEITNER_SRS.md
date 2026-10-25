# Methodik des 5-Fächer-Leitner-Systems & Spaced Repetition (SRS)
*Alexis — Universal Philological Vocabulary Trainer & Corpus Hub*

---

## 1. Didaktisches Grundprinzip

Alexis setzt auf eine zeitlich gestaffelte Wiederholung (*Spaced Repetition System / SRS*), die auf dem klassischen 5-Fächer-Lernkarteiprinzip von Sebastian Leitner basiert, kombiniert mit adaptiver Fälligkeitsberechnung.

Das Ziel besteht darin, Vokabeln im Langzeitgedächtnis zu verankern, indem eine Karte genau dann wiederholt wird, wenn die Vergessenskurve absinkt.

```
       [ Box 1: Täglich (1 Tag) ] ──────────┐ (bei Fehler / "Nochmal")
                   │ "Gut" / "Einfach"       │
                   ▼                         │
       [ Box 2: Kurzfristig (3 Tage) ] ──────┤
                   │ "Gut" / "Einfach"       │
                   ▼                         │
       [ Box 3: Mittelfristig (7 Tage) ] ────┤
                   │ "Gut" / "Einfach"       │
                   ▼                         │
       [ Box 4: Gefestigt (14–21 Tage) ] ────┤
                   │ "Gut" / "Einfach"       │
                   ▼                         │
       [ Box 5: Langzeitgedächtnis (30–45 Tage) ]
```

---

## 2. Intervall- & Boxenzuweisung

Jede Vokabel verfügt über einen Lernzustand (`StudyCardState`):

| Box | Bezeichnung | Standard-Intervall | Pädagogische Funktion |
| :--- | :--- | :--- | :--- |
| **Box 1** | Neu / Nochmal | **1 Tag** | Unbekannte, neu importierte oder falsch beantwortete Wörter. |
| **Box 2** | Erster Lernerfolg | **3 Tage** | Die Vokabel wurde mindestens einmal erfolgreich gewusst. |
| **Box 3** | Festigung | **7 Tage** | Sitzt im Kurz- bis Mittelfristgedächtnis. |
| **Box 4** | Vertiefung | **14–21 Tage** | Hohe Abrufsicherheit. |
| **Box 5** | Langzeitgedächtnis | **30–45 Tage** | Dauerhaft verankert; nur noch sporadische Auffrischung. |

---

## 3. Bewertungsstufen & Übergangsregeln

Beim Aufdecken einer Karte stehen 4 Bewertungen zur Verfügung (per Klick oder Tastenkombination `1`, `2`, `3`, `4` bzw. `Leertaste`):

### 1. Nochmal (`Taste 1`)
- **Regel**: Die Karte fällt **sofort auf Box 1 zurück**.
- **Neues Intervall**: 1 Tag.
- **Erfolgs-Streak**: Wird auf 0 zurückgesetzt.
- **Fehlzähler (`lapse_count`)**: Wird um +1 erhöht.
- **Fälligkeit**: Morgen fällig (`now + 1 Tag`).

### 2. Schwer (`Taste 2`)
- **Regel**: Die Karte verbleibt in der **aktuellen Box**.
- **Neues Intervall**: 1 Tag (kurze Nachprüfung, kein Boxenaufstieg).
- **Streak**: Bleibt unverändert.

### 3. Gut (`Taste 3` oder 2x `Leertaste`)
- **Regel**: Die Karte steigt um **+1 Box auf** (bis maximal Box 5).
- **Neues Intervall**:
  - Box 1 => Box 2: **3 Tage**
  - Box 2 => Box 3: **7 Tage**
  - Box 3 => Box 4: **14 Tage**
  - Box 4 => Box 5: **30 Tage**
- **Streak**: +1 Erfolg in Folge.

### 4. Einfach (`Taste 4`)
- **Regel**: Die Karte steigt um **+1 Box auf** und erhält einen **Bonus-Intervallsprung**:
  - Box 1 => Box 2: **5 Tage** (statt 3)
  - Box 2 => Box 3: **10 Tage** (statt 7)
  - Box 3 => Box 4: **21 Tage** (statt 14)
  - Box 4 => Box 5: **45 Tage** (statt 30)
- **Streak**: +2 Erfolge in Folge.

---

## 4. Berechnungsformel für Fälligkeiten

Für jede bewertete Karte wird der nächste Fälligkeitszeitpunkt nach folgender Formel berechnet:

```
next_due = aktuelle_zeit + (intervall_tage x 86400 Sekunden)
```

Wird beim Start einer Sitzung der Schalter **„Nur fällige Wiederholungen (Spaced Repetition)“** aktiviert, filtert die Datenbankabfrage ausschließlich Einträge mit:

```
s.next_due <= aktuelle_zeit
```

Ist der Schalter deaktiviert, läuft der freie **Lern- & Drillmodus**, in dem alle Vokabeln der gewählten Lektionen geübt werden können, unabhängig vom Fälligkeitsdatum.

---

## 5. Philologische Besonderheiten & Geschlechts-Zwang

Bei flektierenden Sprachen (Sanskrit, Hindi, Latein, Griechisch) ist das grammatische Geschlecht integraler Bestandteil der lexikalischen Identität:

1. **Substantiv-Kennzeichnung**:
   - Jedes Nomen weist zwingend das Geschlecht auf:
     - `m.` (Maskulinum)
     - `f.` (Femininum)
     - `n.` (Neutrum)
     - `m./f.` (Maskulin / Feminin bei belebten Nomina)
2. **Karten-Layout**:
   - Statusleiste oben: Farbiger Badge (`m. (Maskulinum)` / `f. (Femininum)`).
   - Lösungsseite: Das Geschlechts-Kürzel steht direkt vor der deutschen Übersetzung (z.B. `[m.] Zimmer`, `[f.] Buch`), um die Kongruenz im Satzbau zu sichern.

---

## 6. Duplikat-Eliminierung & Konsolidierung

1. **Gleiches Lemma mit mehreren Bedeutungen**:
   - Kommt ein Lemma mehrfach vor (z.B. `जी` als Höflichkeitspartikel und als `ja`), wird **keine zweite Karte** erzeugt.
   - Die Bedeutungen werden auf einer einzigen Karte als nummerierte Teilbedeutungen zusammengefasst.
2. **Mehrfachauswahl über Bände & Lektionen**:
   - Werden z.B. *Lektion 1 + 2 + 3* gemeinsam ausgewählt, wird jedes Lemma in der Sitzung **höchstens einmal** abgefragt (`GROUP BY e.lemma_native`).
   - Existieren abweichende Lernstände, hat die Karte mit der **niedrigeren Box** (höhere Dringlichkeit) Vorrang.

---

## 7. Umkehrbare Lernrichtung (Hindi ⇄ Deutsch)

Alexis unterstützt zwei Lernrichtungen, die jederzeit per Klick auf den Schalter **`⇄ Richtung`** im Trainer-Header oder über die Tastenkombination **`r`** gewechselt werden können:

1. **Zielsprache ➔ Deutsch (z.B. Hindi ➔ DE)**:
   - **Vorderseite**: Devanagari-Schriftbild (`दुकान`), Umschrift (IAST), Wortart und grammatisches Geschlecht.
   - **Rückseite**: Deutsche Übersetzung mit Geschlechts-Pill (`f. Geschäft, Laden`) und Notizen.
2. **Deutsch ➔ Zielsprache (z.B. DE ➔ Hindi)**:
   - **Vorderseite**: Deutsche Bedeutung(en) in großer Serifschrift sowie Wortart (`Substantiv`) und Aufforderung zum Geschlechtsabruf (`Geschlecht: ?`).
   - **Rückseite**: Das gesuchte Wort in Devanagari (`दुकान`), IAST-Umschrift (`dukān`), zwingende Geschlechtsauflösung (`f. (Femininum)`) und Referenzbedeutung.

---

## 8. Abfragereihenfolge: Alphabetisch oder Zufällig (Shuffle)

Alexis erlaubt das Umschalten der Abfragereihenfolge:

1. **Alphabetisch / Lehrbuch-Sequenz**:
   - Vokabeln werden in der didaktischen Reihenfolge der Lektion bzw. des Alphabets vorgelegt.
2. **Zufall (Shuffle / Random)**:
   - Die ausgewählte Vokabelmenge wird nach dem Fisher-Yates-Algorithmus (im SQLite-Backend via `ORDER BY RANDOM()`) gemischt.
   - Umschaltbar über den Schalter **`🔀 Zufall`** im Trainer-Header, die Checkbox in der Gliederungsauswahl oder mit der Taste **`s`**.

---

## 9. Tastaturkürzel-Referenz

| Taste | Kontext | Aktion |
| :--- | :--- | :--- |
| **`Leertaste`** oder **`Enter`** | Vorderseite | Karte aufdecken |
| **`Leertaste`** | Rückseite (aufgedeckt) | Schnellbewertung: **3 (Gut)** |
| **`1`** | Rückseite (aufgedeckt) | Bewertung: **1 (Nochmal)** |
| **`2`** | Rückseite (aufgedeckt) | Bewertung: **2 (Schwer)** |
| **`3`** | Rückseite (aufgedeckt) | Bewertung: **3 (Gut)** |
| **`4`** | Rückseite (aufgedeckt) | Bewertung: **4 (Einfach)** |
| **`r`** | Immer | Lernrichtung umkehren (**Hindi ➔ DE** ⇄ **DE ➔ Hindi**) |
| **`s`** | Immer | Reihenfolge umschalten (**Alphabetisch** ⇄ **Zufall / Shuffle**) |
| **`u`** oder **`t`** | Immer | Umschrift (IAST / Transliteration) ein-/ausblenden |
