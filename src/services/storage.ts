import type {
  CorpusBundle,
  CorpusMeta,
  DeckStats,
  ReviewSubmission,
  StudyCardItem,
  StudyQueueQuery,
  VolumeData,
} from "../types";

import defaultHindiBolo from "../../data/corpora/hindi_bolo.json";
import defaultPayerSanskrit from "../../data/corpora/payer_sanskrit.json";

// Detect if running inside Tauri native webview
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

class StorageService {
  private memoryBundles: CorpusBundle[] = [
    defaultHindiBolo as unknown as CorpusBundle,
    defaultPayerSanskrit as unknown as CorpusBundle,
  ];
  private localStudyState: Map<
    string,
    { box: number; interval: number; successes: number; nextDue: string }
  > = new Map();
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (
      !isTauriEnvironment() &&
      typeof window !== "undefined" &&
      "indexedDB" in window
    ) {
      this.initIndexedDB();
    }
  }

  private initIndexedDB() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("alexis_db", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("study_state")) {
          db.createObjectStore("study_state", { keyPath: "entryId" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // load initial state into memory cache
        const tx = db.transaction("study_state", "readonly");
        const store = tx.objectStore("study_state");
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          for (const item of getAll.result) {
            this.localStudyState.set(item.entryId, item);
          }
          resolve(db);
        };
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async persistStudyState(
    entryId: string,
    state: {
      box: number;
      interval: number;
      successes: number;
      nextDue: string;
    },
  ) {
    this.localStudyState.set(entryId, state);
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const tx = db.transaction("study_state", "readwrite");
        const store = tx.objectStore("study_state");
        store.put({ entryId, ...state });
      } catch (err) {
        console.warn("Could not persist to IndexedDB:", err);
      }
    }
  }

  async listCorpora(): Promise<CorpusMeta[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<CorpusMeta[]>("list_corpora");
    }
    return this.memoryBundles.map((b) => b.corpus);
  }

  async listVolumes(corpusId: string): Promise<VolumeData[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<VolumeData[]>("list_volumes", { corpusId });
    }
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    return bundle ? bundle.volumes : [];
  }

  async getStudyQueue(query: StudyQueueQuery): Promise<StudyCardItem[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<StudyCardItem[]>("get_study_queue", { query });
    }

    // Web / Browser fallback logic:
    const bundle = this.memoryBundles.find(
      (b) => b.corpus.id === query.corpus_id,
    );
    if (!bundle) return [];

    let filtered = bundle.entries;
    if (query.volume_ids && query.volume_ids.length > 0) {
      filtered = filtered.filter((e) =>
        query.volume_ids!.includes(e.volume_id),
      );
    }
    if (query.lesson_ids && query.lesson_ids.length > 0) {
      filtered = filtered.filter(
        (e) => e.lesson_id && query.lesson_ids!.includes(e.lesson_id),
      );
    }
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter((e) =>
        e.tags?.some((t) => query.tags!.includes(t)),
      );
    }

    const now = new Date().toISOString();

    const items: StudyCardItem[] = filtered.map((e) => {
      const vol = bundle.volumes.find((v) => v.id === e.volume_id);
      const state = this.localStudyState.get(e.id) || {
        box: 1,
        interval: 1,
        successes: 0,
        nextDue: now,
      };

      return {
        entry_id: e.id,
        corpus_id: e.corpus_id,
        volume_id: e.volume_id,
        volume_title: vol ? vol.title : e.volume_id,
        lesson_id: e.lesson_id,
        lemma_native: e.lemma_native,
        lemma_translit: e.lemma_translit,
        pos: e.pos,
        gender: e.gender,
        definitions: e.definitions,
        tags: e.tags || [],
        box_number: state.box,
        interval_days: state.interval,
        consecutive_successes: state.successes,
        next_due: state.nextDue,
      };
    });

    if (query.due_only) {
      return items.filter((item) => item.next_due <= now);
    }

    return items.slice(0, query.limit || 100);
  }

  async recordReview(
    review: ReviewSubmission,
  ): Promise<{ box: number; interval: number; nextDue: string }> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<[number, number, string]>("record_review", {
        review,
      });
      return { box: res[0], interval: res[1], nextDue: res[2] };
    }

    // Web fallback: Leitner calculation
    const current = this.localStudyState.get(review.entry_id) || {
      box: 1,
      interval: 1,
      successes: 0,
      nextDue: new Date().toISOString(),
    };

    let newBox = current.box;
    let newInterval = current.interval;
    let newSuccesses = current.successes;

    switch (review.rating) {
      case 1: // Again
        newBox = 1;
        newInterval = 1;
        newSuccesses = 0;
        break;
      case 2: // Hard
        newInterval = 1;
        break;
      case 3: // Good
        newBox = Math.min(5, current.box + 1);
        newInterval = [1, 3, 7, 14, 30][newBox - 1];
        newSuccesses += 1;
        break;
      case 4: // Easy
        newBox = Math.min(5, current.box + 1);
        newInterval = [2, 5, 10, 21, 45][newBox - 1];
        newSuccesses += 2;
        break;
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + newInterval);
    const nextDue = nextDueDate.toISOString();

    const updated = {
      box: newBox,
      interval: newInterval,
      successes: newSuccesses,
      nextDue,
    };

    await this.persistStudyState(review.entry_id, updated);
    return updated;
  }

  async getDeckStats(corpusId?: string): Promise<DeckStats> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<DeckStats>("get_deck_stats", {
        corpusId: corpusId || null,
      });
    }

    let entries = this.memoryBundles.flatMap((b) => b.entries);
    if (corpusId) {
      entries = entries.filter((e) => e.corpus_id === corpusId);
    }

    const now = new Date().toISOString();
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let due = 0;

    for (const e of entries) {
      const state = this.localStudyState.get(e.id);
      const box = state ? state.box : 1;
      const nextDue = state ? state.nextDue : now;

      if (box === 1) b1++;
      else if (box === 2) b2++;
      else if (box === 3) b3++;
      else if (box === 4) b4++;
      else if (box === 5) b5++;

      if (nextDue <= now) due++;
    }

    return {
      total_entries: entries.length,
      box_1: b1,
      box_2: b2,
      box_3: b3,
      box_4: b4,
      box_5: b5,
      due_today: due,
    };
  }

  async importBundle(bundle: CorpusBundle): Promise<number> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<number>("import_corpus_bundle", { bundle });
    }
    const idx = this.memoryBundles.findIndex(
      (b) => b.corpus.id === bundle.corpus.id,
    );
    if (idx >= 0) {
      this.memoryBundles[idx] = bundle;
    } else {
      this.memoryBundles.push(bundle);
    }
    return bundle.entries.length;
  }

  async transliterate(text: string, from: string, to: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string>("transliterate", { text, from, to });
    }
    // Simple basic fallback for web if rust isn't present
    return text;
  }
}

export const storage = new StorageService();
