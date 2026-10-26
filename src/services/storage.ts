import type {
  CorpusBundle,
  CorpusMeta,
  DeckStats,
  LessonData,
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
      const request = indexedDB.open("alexis_db", 2);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("study_state")) {
          db.createObjectStore("study_state", { keyPath: "entryId" });
        }
        if (!db.objectStoreNames.contains("corpus_bundles")) {
          db.createObjectStore("corpus_bundles", { keyPath: "corpusId" });
        }
      };
      request.onsuccess = async () => {
        const db = request.result;
        const loadPromises: Promise<void>[] = [];

        // load initial study state into memory cache
        if (db.objectStoreNames.contains("study_state")) {
          loadPromises.push(
            new Promise<void>((resState) => {
              const tx = db.transaction("study_state", "readonly");
              const store = tx.objectStore("study_state");
              const getAll = store.getAll();
              getAll.onsuccess = () => {
                for (const item of getAll.result) {
                  this.localStudyState.set(item.entryId, item);
                }
                resState();
              };
              getAll.onerror = () => resState();
            }),
          );
        }

        // load persisted custom/imported corpus bundles
        if (db.objectStoreNames.contains("corpus_bundles")) {
          loadPromises.push(
            new Promise<void>((resBundles) => {
              const txBundles = db.transaction("corpus_bundles", "readonly");
              const storeBundles = txBundles.objectStore("corpus_bundles");
              const getAllBundles = storeBundles.getAll();
              getAllBundles.onsuccess = () => {
                for (const item of getAllBundles.result) {
                  const idx = this.memoryBundles.findIndex(
                    (b) => b.corpus.id === item.corpusId,
                  );
                  if (idx >= 0) {
                    this.memoryBundles[idx] = item.bundle;
                  } else {
                    this.memoryBundles.push(item.bundle);
                  }
                }
                resBundles();
              };
              getAllBundles.onerror = () => resBundles();
            }),
          );
        }

        await Promise.all(loadPromises);
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.dbPromise) {
      await this.dbPromise;
    }
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
        if (db.objectStoreNames.contains("study_state")) {
          const tx = db.transaction("study_state", "readwrite");
          const store = tx.objectStore("study_state");
          store.put({ entryId, ...state });
        }
      } catch (err) {
        console.warn("Could not persist to IndexedDB:", err);
      }
    }
  }

  private async persistCorpusBundle(corpusId: string, bundle: CorpusBundle) {
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db.objectStoreNames.contains("corpus_bundles")) {
          const tx = db.transaction("corpus_bundles", "readwrite");
          const store = tx.objectStore("corpus_bundles");
          store.put({
            corpusId,
            bundle: JSON.parse(JSON.stringify(bundle)),
          });
        }
      } catch (err) {
        console.warn("Could not persist bundle to IndexedDB:", err);
      }
    }
  }

  async listCorpora(): Promise<CorpusMeta[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<CorpusMeta[]>("list_corpora");
    }
    await this.ensureInitialized();
    return this.memoryBundles.map((b) => b.corpus);
  }

  async listVolumes(corpusId: string): Promise<VolumeData[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<VolumeData[]>("list_volumes", { corpusId });
    }
    await this.ensureInitialized();
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    if (!bundle) return [];
    return bundle.volumes.map((v) => {
      const entry_count = bundle.entries.filter(
        (e) => e.volume_id === v.id,
      ).length;
      return { ...v, entry_count };
    });
  }

  async listLessons(
    corpusId: string,
    volumeId?: string,
  ): Promise<LessonData[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<LessonData[]>("list_lessons", {
        corpusId,
        volumeId: volumeId || null,
      });
    }
    await this.ensureInitialized();
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    if (!bundle) return [];
    let lessons = bundle.lessons;
    if (volumeId) {
      lessons = lessons.filter((l) => l.volume_id === volumeId);
    }
    return lessons.map((l) => {
      const entry_count = bundle.entries.filter(
        (e) => e.lesson_id === l.id,
      ).length;
      return { ...l, entry_count };
    });
  }

  async getStudyQueue(query: StudyQueueQuery): Promise<StudyCardItem[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<StudyCardItem[]>("get_study_queue", { query });
    }
    await this.ensureInitialized();

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
        grammar_metadata: e.grammar_metadata,
        definitions: e.definitions.map((d) => ({ ...d })),
        tags: [...(e.tags || [])],
        box_number: state.box,
        interval_days: state.interval,
        consecutive_successes: state.successes,
        next_due: state.nextDue,
      };
    });

    // Deduplicate across selected volumes/lessons by lemma_native
    const seen = new Map<string, StudyCardItem>();
    for (const item of items) {
      const key = item.lemma_native.trim();
      if (!seen.has(key)) {
        seen.set(key, item);
      } else {
        const existing = seen.get(key)!;
        // Merge definitions if distinct
        for (const def of item.definitions) {
          if (
            !existing.definitions.some(
              (d) => d.meaning.trim() === def.meaning.trim(),
            )
          ) {
            existing.definitions.push(def);
          }
        }
        // Merge tags
        for (const t of item.tags) {
          if (!existing.tags.includes(t)) {
            existing.tags.push(t);
          }
        }
        // Prioritize lower/more urgent Leitner box
        if (
          item.box_number < existing.box_number ||
          (item.box_number === existing.box_number &&
            item.next_due < existing.next_due)
        ) {
          existing.box_number = item.box_number;
          existing.interval_days = item.interval_days;
          existing.next_due = item.next_due;
        }
      }
    }
    const deduplicated = Array.from(seen.values());

    let result = query.due_only
      ? deduplicated.filter((item) => item.next_due <= now)
      : deduplicated;

    if (query.shuffle) {
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
    }

    if (query.limit && query.limit > 0) {
      result = result.slice(0, query.limit);
    }

    return result;
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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

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
    await this.ensureInitialized();
    const idx = this.memoryBundles.findIndex(
      (b) => b.corpus.id === bundle.corpus.id,
    );
    if (idx >= 0) {
      this.memoryBundles[idx] = bundle;
    } else {
      this.memoryBundles.push(bundle);
    }
    await this.persistCorpusBundle(bundle.corpus.id, bundle);
    return bundle.entries.length;
  }

  async importTSV(
    tsvContent: string,
    targetCorpusId = "hindi-bolo",
  ): Promise<number> {
    await this.ensureInitialized();
    const lines = tsvContent.trim().split("\n");
    if (lines.length < 2) return 0;
    const header = lines[0].split("\t").map((h) => h.trim().toLowerCase());

    const colVol = header.indexOf("volume");
    const colLes = header.indexOf("lesson");
    const colNat = header.indexOf("native");
    const colTrn = header.indexOf("transliteration");
    const colPos = header.indexOf("pos");
    const colGen = header.indexOf("gender");
    const colMng = header.findIndex((h) => h.includes("meaning"));
    const colTag = header.indexOf("tags");

    const bundle = this.memoryBundles.find(
      (b) => b.corpus.id === targetCorpusId,
    );
    if (!bundle) return 0;

    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split("\t");
      if (parts.length < 4) continue;
      const vol = colVol >= 0 ? parts[colVol]?.trim() : "hb1";
      const les = colLes >= 0 ? parts[colLes]?.trim() : "1";
      const nat = colNat >= 0 ? parts[colNat]?.trim() : "";
      const trn = colTrn >= 0 ? parts[colTrn]?.trim() : "";
      const pos = colPos >= 0 ? parts[colPos]?.trim() : "";
      const gen = colGen >= 0 ? parts[colGen]?.trim() : "";
      const mng = colMng >= 0 ? parts[colMng]?.trim() : "";

      if (!nat || !mng) continue;
      const cleanNat = nat.replace(/\r/g, "").trim();
      const cleanMng = mng.replace(/\r/g, "").trim();
      const cleanTrn = trn.replace(/\r/g, "").trim();
      const cleanTags = (
        colTag >= 0 && parts[colTag]
          ? parts[colTag].replace(/\r/g, "").split(";")
          : []
      )
        .map((t) => t.trim())
        .filter(Boolean);

      // Ensure volume is registered in bundle.volumes
      if (!bundle.volumes.some((v) => v.id === vol)) {
        const volNum = vol.replace(/^[a-zA-Z]+/, "");
        const volTitle = vol.startsWith("hb")
          ? `Hindi bolo ${volNum || vol}`
          : `Band ${volNum || vol}`;
        bundle.volumes.push({
          id: vol,
          corpus_id: targetCorpusId,
          title: volTitle,
          sort_order: bundle.volumes.length + 1,
        });
      }

      // Ensure lesson is registered in bundle.lessons
      const lessonId = `${vol}_l${les.padStart(2, "0")}`;
      if (!bundle.lessons.some((l) => l.id === lessonId)) {
        const lesNum = Number.parseInt(les, 10) || bundle.lessons.length + 1;
        bundle.lessons.push({
          id: lessonId,
          volume_id: vol,
          lesson_number: lesNum,
          title: `Lektion ${les}`,
          sort_order: lesNum,
        });
      }

      const existing = bundle.entries.find(
        (e) =>
          e.lemma_native.trim() === cleanNat && (e.volume_id === vol || !vol),
      );

      if (existing) {
        // Merge definition without duplicates
        if (!existing.definitions.some((d) => d.meaning.trim() === cleanMng)) {
          existing.definitions.push({ lang: "de", meaning: cleanMng });
        }
        // Merge tags
        for (const t of cleanTags) {
          if (!existing.tags?.includes(t)) {
            existing.tags = existing.tags || [];
            existing.tags.push(t);
          }
        }
        if (!existing.pos && pos) existing.pos = pos.trim();
        if (!existing.gender && gen && gen !== "-")
          existing.gender = gen.trim();
      } else {
        const id = `${vol}_l${les.padStart(2, "0")}_${String(
          bundle.entries.length + 1,
        ).padStart(3, "0")}`;
        bundle.entries.push({
          id,
          corpus_id: targetCorpusId,
          volume_id: vol,
          lesson_id: lessonId,
          lemma_native: cleanNat,
          lemma_translit: cleanTrn,
          pos: pos ? pos.trim() : undefined,
          gender: gen && gen !== "-" ? gen.trim() : undefined,
          definitions: [{ lang: "de", meaning: cleanMng }],
          tags: cleanTags,
        });
        count++;
      }
    }

    await this.persistCorpusBundle(targetCorpusId, bundle);
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("import_corpus_bundle", { bundle });
    }
    return count;
  }

  async transliterate(text: string, from: string, to: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string>("transliterate", { text, from, to });
    }
    // Simple basic fallback for web if rust isn't present
    return text;
  }

  async exportSelectionTSV(
    corpusId: string,
    volumeIds?: string[],
    lessonIds?: string[],
  ): Promise<string> {
    await this.ensureInitialized();
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    if (!bundle) return "";

    let entries = bundle.entries;
    if (volumeIds && volumeIds.length > 0) {
      entries = entries.filter((e) => volumeIds.includes(e.volume_id));
    }
    if (lessonIds && lessonIds.length > 0) {
      entries = entries.filter(
        (e) => e.lesson_id && lessonIds.includes(e.lesson_id),
      );
    }

    const header =
      "volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags";
    const rows = entries.map((e) => {
      const les = bundle.lessons.find((l) => l.id === e.lesson_id);
      const lesNum = les
        ? String(les.lesson_number)
        : e.lesson_id
          ? e.lesson_id.replace(/^.*_l0?/, "")
          : "1";
      const mean = e.definitions.map((d) => d.meaning).join("; ");
      const tags = (e.tags || []).join(";");
      return [
        e.volume_id,
        lesNum,
        e.lemma_native,
        e.lemma_translit,
        e.pos || "",
        e.gender || "-",
        mean,
        tags,
      ].join("\t");
    });

    return [header, ...rows].join("\n");
  }

  getCorpusBundle(corpusId: string): CorpusBundle | undefined {
    return this.memoryBundles.find((b) => b.corpus.id === corpusId);
  }

  exportStudyBackup(): Record<string, any> {
    const backup: Record<string, any> = {};
    for (const [key, val] of this.localStudyState.entries()) {
      backup[key] = val;
    }
    return backup;
  }
}

export function downloadTSV(content: string, filename: string) {
  const blob = new Blob([content], {
    type: "text/tab-separated-values;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".tsv") ? filename : `${filename}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const storage = new StorageService();
