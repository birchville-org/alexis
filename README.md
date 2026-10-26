# Alexis (Ἀλέξις / Lexis)

> Universal philological vocabulary trainer, corpus reader, and dictionary hub.

Alexis is an offline-capable, corpus-driven vocabulary learning platform designed for classical and philological languages (Sanskrit, Latin, Ancient Greek, Pali, etc.). It decouples curated learning corpora (such as the Alois Payer Sanskrit course) from static course materials and interfaces directly with authoritative digital lexicons (Monier-Williams, Cologne Sanskrit Dictionaries, Apte, Lewis & Short, LSJ).

---

## Key Pillars

1. **Pluggable Corpora (Corpus Adapters)**
   - Import structured wordlists from courses, textbooks, and text editions.
   - Preserves lesson progress, grammatical metadata (part of speech, root, class/gana, voice, gender), and original sentence context.
   - Built-in adapter for the 48-language Alois Payer Sanskrit course (`sanskritkurs-payer`).

2. **Authoritative Dictionary Hub (Dictionary Providers)**
   - Deep-linking and on-demand entry lookups into authoritative scholarly dictionaries.
   - First-class support for Monier-Williams Sanskrit-English Dictionary (Cologne Digital Sanskrit Dictionaries / local pruned cache).
   - Expandable provider architecture for Apte, Böhtlingk (PW), Lewis & Short, and LSJ.

3. **Philological Spaced Repetition (SRS)**
   - Adaptive scheduling (Leitner / FSRS / SM-2) optimized for inflected languages.
   - Bi-directional drills: Script recognition (e.g. Devanāgarī / Polytonic Greek) ↔ Romanized transcription (IAST) ↔ Target meaning.
   - Grammar-aware flashcards (roots, principal parts, declension patterns).

4. **100% Client-Side & Offline First**
   - Zero-tracking, privacy-first local storage via IndexedDB and Web Storage.
   - Progressive Web App (PWA) ready for mobile and desktop study.

---

## Architecture Overview

```
                      ┌──────────────────────┐
                      │     Alexis UI        │
                      │ (Vue 3 / TypeScript) │
                      └──────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌──────────────────┐            ┌──────────────────┐
       │  Corpus Adapters │            │   Dict Providers │
       └─────────┬────────┘            └─────────┬────────┘
                 │                               │
        ┌────────┴────────┐             ┌────────┴────────┐
        │                 │             │                 │
     Payer            Classical      Monier-            Cologne
    Sanskrit          Editions      Williams              API
    (48 langs)       (TEI/JSON)      (Cache)           (On-demand)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full technical specifications and schema definitions.
For our UX concept, Anki comparison, and phased milestones, see [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Quickstart

```bash
# Clone the repository
git clone https://github.com/birchville-org/alexis.git
cd alexis

# Install dependencies
npm install

# Run development server
npm run dev
```

---

## Project Structure

```
alexis/
├── data/                  # Sample corpora and dictionary indices
│   └── corpora/           # Standardized corpus manifests
├── docs/                  # Architecture, schemas, and design docs
│   └── ARCHITECTURE.md
├── src/
│   ├── adapters/          # Corpus import parsers
│   ├── providers/         # Dictionary lookup providers
│   ├── engine/            # Spaced repetition & Leitner logic
│   ├── components/        # Vue UI components
│   └── types/             # TypeScript domain models
├── public/                # Static assets, fonts, icons
└── package.json
```

---

## License

MIT License. Copyright (c) 2026 Marco Demarmels. Birchville Scholarly Synthesis.
