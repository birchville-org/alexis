# Alexis Architecture & Design Contract

## 1. Domain Models (`src/types/index.ts`)

### 1.1 Lexical Entry (`LexicalEntry`)
```typescript
export interface LexicalEntry {
  id: string;                      // Unique ID (e.g. "payer_sa_l02_deva")
  corpusId: string;                // Identifier of originating corpus
  lesson?: number | string;        // Lesson / Chapter identifier
  lemma: {
    native: string;                // Native script (e.g. "देव")
    transliteration: string;       // Academic transliteration (e.g. "deva")
    script: 'Deva' | 'Grek' | 'Latn' | string;
  };
  pos: 'noun' | 'verb' | 'adj' | 'ind' | 'pron' | 'part' | string;
  gender?: 'm' | 'f' | 'n';
  grammarMetadata?: {
    root?: string;                 // e.g. "√दिव्"
    gana?: number;                 // e.g. 1
    pada?: 'P' | 'A' | 'U';        // Parasmaipada, Atmanepada, Ubhayapada
    stem?: string;
  };
  definitions: {
    lang: string;                  // ISO 639-1 (e.g. "de", "en", "fr")
    meaning: string;
    notes?: string;
  }[];
  contextExamples?: {
    original: string;
    translation: string;
    sourceRef?: string;
  }[];
  dictionaryRefs?: {
    source: 'MW' | 'APTE' | 'PW' | 'LSJ' | 'LEWIS_SHORT' | string;
    key: string;                   // Dictionary lookup headword
    refId?: string;
  }[];
}
```

### 1.2 Learning Card & Progress State (`StudyCardState`)
```typescript
export interface StudyCardState {
  entryId: string;
  box: number;                     // Leitner box 1..5
  intervalDays: number;
  easeFactor: number;              // Standard 2.5
  consecutiveSuccesses: number;
  lastReviewed: string | null;     // ISO 8601
  nextDue: string;                 // ISO 8601
  userNote?: string;               // Personal device-local learning note
  history: {
    timestamp: string;
    rating: 1 | 2 | 3 | 4;         // 1: Again, 2: Hard, 3: Good, 4: Easy
    durationMs: number;
  }[];
}
```

---

## 2. Dictionary Provider Interface

```typescript
export interface DictionaryResult {
  source: string;
  headword: string;
  transliteration?: string;
  grammaticalInfo?: string;
  definitions: string[];
  etymology?: string;
  externalUrl?: string;
}

export interface DictionaryProvider {
  id: string;
  name: string;
  supportedLanguages: string[];
  lookup(query: string, lang?: string): Promise<DictionaryResult[]>;
}
```

### Monier-Williams Implementation
- **Online Provider**: Queries Cologne Digital Sanskrit Dictionaries REST endpoint (`https://www.sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/getword.php`).
- **Offline Pruned Provider**: Matches pre-computed dictionary chunks for curated course corpora packaged within the app assets.

---

## 3. Storage & Persistence
- **Browser / PWA (`IndexedDB`, `alexis_db` v3)**: Stores `study_state` (Leitner progress + `userNote`), `corpus_bundles` (additive custom volumes/lessons/entries without shadowing built-in updates), and `entry_overrides` (device-local or `?review=1` delta overrides).
- **Desktop App (Tauri `SQLite`)**: Stores corpora, entries, `study_state` (including `user_note`), and durable local edits in `alexis.db`.
- **Editorial Dev Git-Sync & Review Deltas**: In local Vite dev mode (`localhost`), corpus edits and TSV imports sync via `/__alexis_dev/corpus` directly into `data/corpora/*.json`. External reviewers on `?review=1` export changes as `alexis-review-delta-v1` JSON for selective editorial merge via `📥 Delta prüfen`.
- **Import/Export**: 9-column UTF-8 TSV (`volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags\tnotes`, backward-compatible with 8-column TSVs / Anki) plus JSON study backups.
