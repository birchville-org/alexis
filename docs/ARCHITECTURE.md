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
- **Client Database**: IndexedDB (using Dexie or raw IDB) for zero server-side storage overhead.
- **Import/Export**: JSON format compatible with Anki decks (`.tsv` export) and Payer vocabulary loaders.
