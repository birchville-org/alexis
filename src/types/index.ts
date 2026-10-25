export interface CorpusMeta {
  id: string;
  title: string;
  lang_code: string;
  script: string;
  target_lang: string;
  description?: string;
}

export interface VolumeData {
  id: string;
  corpus_id: string;
  title: string;
  sort_order: number;
  level?: string;
  entry_count?: number;
}

export interface LessonData {
  id: string;
  volume_id: string;
  lesson_number: number;
  title: string;
  sort_order: number;
  entry_count?: number;
}

export interface EntryDefinition {
  lang: string;
  meaning: string;
  notes?: string;
}

export interface EntryData {
  id: string;
  corpus_id: string;
  volume_id: string;
  lesson_id?: string;
  lemma_native: string;
  lemma_translit: string;
  pos?: string;
  gender?: string;
  grammar_metadata?: Record<string, any>;
  definitions: EntryDefinition[];
  tags?: string[];
  context_examples?: any;
  dictionary_refs?: any;
}

export interface CorpusBundle {
  corpus: CorpusMeta;
  volumes: VolumeData[];
  lessons: LessonData[];
  entries: EntryData[];
}

export interface StudyQueueQuery {
  corpus_id: string;
  volume_ids?: string[];
  lesson_ids?: string[];
  tags?: string[];
  due_only: boolean;
  limit?: number;
}

export interface StudyCardItem {
  entry_id: string;
  corpus_id: string;
  volume_id: string;
  volume_title: string;
  lesson_id?: string;
  lemma_native: string;
  lemma_translit: string;
  pos?: string;
  gender?: string;
  definitions: EntryDefinition[];
  tags: string[];
  box_number: number;
  interval_days: number;
  consecutive_successes: number;
  next_due: string;
}

export interface ReviewSubmission {
  entry_id: string;
  rating: number; // 1: Again, 2: Hard, 3: Good, 4: Easy
  duration_ms?: number;
  direction: string; // 'NATIVE_TO_MEANING', etc.
}

export interface DeckStats {
  total_entries: number;
  box_1: number;
  box_2: number;
  box_3: number;
  box_4: number;
  box_5: number;
  due_today: number;
}

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
