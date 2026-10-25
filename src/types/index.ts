export interface LexicalEntry {
  id: string;
  corpusId: string;
  lesson?: number | string;
  lemma: {
    native: string;
    transliteration: string;
    script: string;
  };
  pos: string;
  gender?: 'm' | 'f' | 'n';
  grammarMetadata?: {
    root?: string;
    gana?: number;
    pada?: 'P' | 'A' | 'U';
    stem?: string;
  };
  definitions: {
    lang: string;
    meaning: string;
    notes?: string;
  }[];
  contextExamples?: {
    original: string;
    translation: string;
    sourceRef?: string;
  }[];
  dictionaryRefs?: {
    source: string;
    key: string;
    refId?: string;
  }[];
}

export interface StudyCardState {
  entryId: string;
  box: number;
  intervalDays: number;
  easeFactor: number;
  consecutiveSuccesses: number;
  lastReviewed: string | null;
  nextDue: string;
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
