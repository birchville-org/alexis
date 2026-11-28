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
- **Desktop App (Tauri `SQLite`)**: Stores corpora, entries, `study_state` (including `review_count`, `user_note`), and durable local edits in `alexis.db`. Commands `export_study_state`, `import_study_state` (SQLite `datetime()` normalization for `next_due`, `MAX` on `review_count`, `COALESCE` preservation for `user_note`), and `export_corpus_bundles` maintain backup/restore parity with the browser store.
- **Editorial Dev Git-Sync & Review Deltas**: In local Vite dev mode (`localhost`), corpus edits and TSV imports sync via `/__alexis_dev/corpus` directly into `data/corpora/*.json`. External reviewers on `?review=1` export changes as `alexis-review-delta-v1` JSON for selective editorial merge via `📥 Delta prüfen`.
- **Import/Export & Study Backups (`alexis-backup-v2`)**: 9-column UTF-8 TSV (`volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags\tnotes`, backward-compatible with 8-column TSVs / Anki) plus `alexis-backup-v2` JSON backups bundling `study_state` (with ISO `nextDue`, `reviewCount`, `userNote`), `entry_overrides`, and `custom_corpora` (computed via diff against canonical bundles). Restores run `inspectStudyBackup` upfront for schema/payload validation (backward-compatible with legacy v1 study-state maps while rejecting review deltas and corpus JSONs), apply `custom_corpora` via delta-only bundle imports, apply `entry_overrides`, and merge `study_state` while preserving existing local notes when omitted.

---

## 4. Transliteration & Interlinear IAST
- **Core Engine (`src/services/iastCore.ts`)**: Zero-dependency TypeScript core supporting exact 1:1 Sanskrit (`"sa"`) and Stage-1 Client-Hybrid Hindi (`"hi"`) transliteration (Akṣara tokenizer, Ohala medial/final schwa deletion, final repha rule, morpheme boundaries, full Nukta support, curated `HINDI_LEXICON`, and unified strict IAST anusvāra `ṃ`). Mirrored counterpart of `birchville-blog/docs/.vitepress/theme/iastTransliterator.js`.
- **Service Integration (`src/services/transliteration.ts`)**: Extends `IAST_MAP.consonants` with unambiguous Nukta mappings (`ḵh`, `q`, `ġ`, `z`, `f`) while omitting `ṛ`/`ṛh` from consonant precedence so Sanskrit vocalic `ṛ` remains intact. Routes `lang = "hi"` directly through `iastCore.ts` (`devanagariHindiToIastSync` / `devanagariToIastSync`) and preserves Tauri Rust acceleration for `lang = "sa"`.
- **Domain Consumers**:
  - `src/services/corpusAudit.ts`: Uses `devanagariHindiToIastSync` for automated Hindi `suggestedTranslit` hints and Nukta/diacritic validation.
  - `src/providers/hindiDictionary.ts`: Normalizes Devanāgarī lookup queries via `devanagariHindiToIastSync`.
  - `src/services/hindiMorphology.ts`: Uses unified strict IAST `ṃ` across declension and conjugation tables (`transliteration.ts` and `monierWilliams.ts` continue accepting both `ṃ` and `ṁ` on input).
  - `src/components/InterlinearText.vue` & `src/components/VocabularyExplorer.vue`: Render XSS-free interlinear `<ruby>` annotations via `segmentDevanagariForRuby()` when the *Lesehilfe (`अ + IAST Interlinear`)* toggle is active.
- **Verification**: `npm run test:iast` (`scripts/test-iast.mjs`) validates Sanskrit 1:1, Hindi schwa/Nukta/morphology cases, ruby segmentation, and `ṃ` consistency.

---

## 5. Sanskrit Audio & Speech Synthesis (`src/services/speech.ts`)
- **Curated Sanskrit Audio Pack (`public/audio/sa/*.m4a`, `src/data/sanskritAudioIds.json`)**: All 880 Payer Sanskrit entries are pre-rendered at 24 kHz mono AAC-LC (`32 kbps`) via `scripts/generate_sanskrit_audio.py` using `ai4bharat/indic-parler-tts` (speaker `Aryan`, Apache-2.0) with silence trimming (`silenceremove`) and outlier retry guards.
- **Runtime Playback & Fallback**: When `SpeechService.speak(text, "sa", { entryId })` matches an ID in `sanskritAudioIds.json`, Alexis plays `${BASE_URL}audio/sa/<entryId>.m4a` (`media-src` permitted in `src-tauri/tauri.conf.json`). In Tauri desktop builds the 880 `.m4a` clips are bundled offline; in Web/PWA deployments (`index.html`, `public/manifest.json`, dedicated icons in `public/icons/`), users can optionally pre-cache all 880 clips (~5.7 MB) via the Offline modal (`cacheAllSanskritAudio` -> `alexis-sanskrit-audio-v1`), and `public/sw.js` serves cached `.m4a` files offline with synthesized `206 Partial Content` HTTP range responses (`serveAudioFromCache`). Without cached audio in an offline browser session, or for custom Sanskrit imports and Hindi entries, `SpeechService` falls back automatically to the local W3C Web Speech API (`speechSynthesis`) with `rate = 0.88`.
