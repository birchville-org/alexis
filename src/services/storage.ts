import type {
  CorpusBundle,
  CorpusMeta,
  DeckStats,
  EntryDefinition,
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

export interface EntryPatch {
  id: string;
  lemma_native: string;
  lemma_translit: string;
  pos?: string | null;
  gender?: string | null;
  definitions?: EntryDefinition[];
  tags?: string[];
  reviewer_comment?: string;
}

export interface EntrySnapshot {
  lemma_native: string;
  lemma_translit: string;
  pos: string | null;
  gender: string | null;
  definitions: EntryDefinition[];
  tags: string[];
}

export interface ReviewDeltaItem {
  id: string;
  volume_id: string;
  lesson_id?: string | null;
  before: EntrySnapshot;
  after: EntrySnapshot;
  reviewer_comment?: string;
}

export interface ReviewDeltaDocument {
  schema: "alexis-review-delta-v1";
  corpus_id: string;
  corpus_title: string;
  exported_at: string;
  changes: ReviewDeltaItem[];
}

export interface StudyStateBackupEntry {
  box: number;
  interval: number;
  successes: number;
  nextDue: string;
  reviewCount?: number;
  userNote?: string;
}

export interface CustomCorpusAddition {
  corpus_id: string;
  corpus_meta?: CorpusMeta;
  volumes: VolumeData[];
  lessons: LessonData[];
  entries: CorpusBundle["entries"];
}

export interface FullStudyBackupDocument {
  schema: "alexis-backup-v2";
  created_at: string;
  study_state: Record<string, StudyStateBackupEntry>;
  entry_overrides?: EntryPatch[];
  custom_corpora?: CustomCorpusAddition[];
}

export interface BackupInspection {
  schemaVersion: "v1" | "v2";
  createdAt: string | null;
  totalStudyCount: number;
  applicableStudyCount: number;
  skippedStudyCount: number;
  overridesCount: number;
  customCorporaCount: number;
  customEntriesCount: number;
  studyState: Record<string, StudyStateBackupEntry>;
  entryOverrides: EntryPatch[];
  customCorpora: CustomCorpusAddition[];
}

export interface LastBackupMeta {
  timestamp: string;
  filename: string;
  studyEntriesCount: number;
  overridesCount: number;
  customEntriesCount: number;
}

const LAST_BACKUP_STORAGE_KEY = "alexis_last_backup_meta";

export function toEntrySnapshot(e: {
  lemma_native: string;
  lemma_translit: string;
  pos?: string | null;
  gender?: string | null;
  definitions: EntryDefinition[];
  tags?: string[];
}): EntrySnapshot {
  return {
    lemma_native: e.lemma_native,
    lemma_translit: e.lemma_translit,
    pos: e.pos || null,
    gender: e.gender && e.gender !== "-" ? e.gender : null,
    definitions: e.definitions.map((d) => ({
      lang: d.lang || "de",
      meaning: d.meaning,
      ...(d.notes ? { notes: d.notes } : {}),
    })),
    tags: [...(e.tags || [])],
  };
}

export function snapshotsEqual(a: EntrySnapshot, b: EntrySnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const CANONICAL_BUNDLES: CorpusBundle[] = [
  defaultHindiBolo as unknown as CorpusBundle,
  defaultPayerSanskrit as unknown as CorpusBundle,
];

function cloneBundle(bundle: CorpusBundle): CorpusBundle {
  return JSON.parse(JSON.stringify(bundle)) as CorpusBundle;
}

function applyPatchToEntry(
  entry: CorpusBundle["entries"][number],
  patch: EntryPatch,
) {
  entry.lemma_native = patch.lemma_native;
  entry.lemma_translit = patch.lemma_translit;
  entry.pos = patch.pos || undefined;
  entry.gender =
    patch.gender && patch.gender !== "-" ? patch.gender : undefined;
  if (patch.definitions !== undefined) {
    entry.definitions = patch.definitions.map((d) => ({ ...d }));
  }
  if (patch.tags !== undefined) {
    entry.tags = [...patch.tags];
  }
}

function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function normalizeToIsoTimestamp(raw: unknown): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) {
      const sqliteMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed);
      const parsed = new Date(
        sqliteMatch ? `${trimmed.replace(" ", "T")}Z` : trimmed,
      );
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

function extractCorpusDiffs(
  bundles: CorpusBundle[],
  overrideSource?: Map<string, EntryPatch>,
): {
  entry_overrides: EntryPatch[];
  custom_corpora: CustomCorpusAddition[];
} {
  const entry_overrides: EntryPatch[] = [];
  const custom_corpora: CustomCorpusAddition[] = [];

  if (overrideSource) {
    for (const ov of overrideSource.values()) {
      entry_overrides.push(JSON.parse(JSON.stringify(ov)) as EntryPatch);
    }
  } else {
    const canonicalEntryMap = new Map<
      string,
      ReturnType<typeof toEntrySnapshot>
    >();
    for (const cb of CANONICAL_BUNDLES) {
      for (const ce of cb.entries) {
        canonicalEntryMap.set(ce.id, toEntrySnapshot(ce));
      }
    }
    for (const bundle of bundles) {
      for (const entry of bundle.entries) {
        const canonSnap = canonicalEntryMap.get(entry.id);
        if (canonSnap && !snapshotsEqual(canonSnap, toEntrySnapshot(entry))) {
          entry_overrides.push({
            id: entry.id,
            lemma_native: entry.lemma_native,
            lemma_translit: entry.lemma_translit,
            pos: entry.pos || null,
            gender: entry.gender || null,
            definitions: entry.definitions.map((d) => ({ ...d })),
            tags: [...(entry.tags || [])],
          });
        }
      }
    }
  }

  for (const bundle of bundles) {
    const canon = CANONICAL_BUNDLES.find(
      (c) => c.corpus.id === bundle.corpus.id,
    );
    if (!canon) {
      custom_corpora.push({
        corpus_id: bundle.corpus.id,
        corpus_meta: { ...bundle.corpus },
        volumes: bundle.volumes.map((v) => ({ ...v })),
        lessons: bundle.lessons.map((l) => ({ ...l })),
        entries: bundle.entries.map(
          (e) =>
            JSON.parse(JSON.stringify(e)) as CorpusBundle["entries"][number],
        ),
      });
      continue;
    }

    const canonVolIds = new Set(canon.volumes.map((v) => v.id));
    const canonLessonIds = new Set(canon.lessons.map((l) => l.id));
    const canonEntryIds = new Set(canon.entries.map((e) => e.id));
    const extraVolumes = bundle.volumes.filter((v) => !canonVolIds.has(v.id));
    const extraLessons = bundle.lessons.filter(
      (l) => !canonLessonIds.has(l.id),
    );
    const extraEntries = bundle.entries.filter((e) => !canonEntryIds.has(e.id));
    if (
      extraVolumes.length > 0 ||
      extraLessons.length > 0 ||
      extraEntries.length > 0
    ) {
      custom_corpora.push({
        corpus_id: bundle.corpus.id,
        volumes: extraVolumes.map((v) => ({ ...v })),
        lessons: extraLessons.map((l) => ({ ...l })),
        entries: extraEntries.map(
          (e) =>
            JSON.parse(JSON.stringify(e)) as CorpusBundle["entries"][number],
        ),
      });
    }
  }

  return { entry_overrides, custom_corpora };
}

class StorageService {
  private memoryBundles: CorpusBundle[] = CANONICAL_BUNDLES.map(cloneBundle);
  private localStudyState: Map<
    string,
    {
      box: number;
      interval: number;
      successes: number;
      nextDue: string;
      userNote?: string;
    }
  > = new Map();
  private entryOverrides: Map<string, EntryPatch> = new Map();
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
      const request = indexedDB.open("alexis_db", 3);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("study_state")) {
          db.createObjectStore("study_state", { keyPath: "entryId" });
        }
        if (!db.objectStoreNames.contains("corpus_bundles")) {
          db.createObjectStore("corpus_bundles", { keyPath: "corpusId" });
        }
        if (!db.objectStoreNames.contains("entry_overrides")) {
          db.createObjectStore("entry_overrides", { keyPath: "id" });
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

        // load persisted custom/imported corpus bundles without shadowing canonical built-in updates
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
                    const base = this.memoryBundles[idx];
                    const persisted = item.bundle as CorpusBundle;
                    const baseVolIds = new Set(base.volumes.map((v) => v.id));
                    for (const vol of persisted.volumes || []) {
                      if (!baseVolIds.has(vol.id)) {
                        base.volumes.push(vol);
                      }
                    }
                    const baseLessonIds = new Set(
                      base.lessons.map((l) => l.id),
                    );
                    for (const les of persisted.lessons || []) {
                      if (!baseLessonIds.has(les.id)) {
                        base.lessons.push(les);
                      }
                    }
                    const baseEntryIds = new Set(base.entries.map((e) => e.id));
                    for (const entry of persisted.entries || []) {
                      if (!baseEntryIds.has(entry.id)) {
                        base.entries.push(entry);
                      }
                    }
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

        // apply per-entry user/audit overrides on top of canonical and imported bundles
        if (db.objectStoreNames.contains("entry_overrides")) {
          await new Promise<void>((resOverrides) => {
            const txOv = db.transaction("entry_overrides", "readonly");
            const storeOv = txOv.objectStore("entry_overrides");
            const getAllOv = storeOv.getAll();
            getAllOv.onsuccess = () => {
              for (const ov of getAllOv.result as EntryPatch[]) {
                this.entryOverrides.set(ov.id, ov);
                for (const bundle of this.memoryBundles) {
                  const target = bundle.entries.find((e) => e.id === ov.id);
                  if (target) {
                    applyPatchToEntry(target, ov);
                  }
                }
              }
              resOverrides();
            };
            getAllOv.onerror = () => resOverrides();
          });
        }

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
      userNote?: string;
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

  private async persistEntryOverrides(patches: EntryPatch[]) {
    if (patches.length === 0) return;
    const toPersist: EntryPatch[] = [];
    const toClear: string[] = [];

    for (const patch of patches) {
      const prev = this.entryOverrides.get(patch.id);
      const reviewer_comment =
        patch.reviewer_comment !== undefined
          ? patch.reviewer_comment.trim() || undefined
          : prev?.reviewer_comment;

      let canonEntry: CorpusBundle["entries"][number] | undefined;
      for (const cb of CANONICAL_BUNDLES) {
        canonEntry = cb.entries.find((e) => e.id === patch.id);
        if (canonEntry) break;
      }
      let liveEntry: CorpusBundle["entries"][number] | undefined;
      for (const lb of this.memoryBundles) {
        liveEntry = lb.entries.find((e) => e.id === patch.id);
        if (liveEntry) break;
      }

      if (
        canonEntry &&
        liveEntry &&
        !reviewer_comment &&
        snapshotsEqual(toEntrySnapshot(canonEntry), toEntrySnapshot(liveEntry))
      ) {
        toClear.push(patch.id);
        continue;
      }

      const merged: EntryPatch = {
        ...prev,
        ...patch,
        definitions: patch.definitions ?? prev?.definitions,
        tags: patch.tags ?? prev?.tags,
        reviewer_comment,
      };
      this.entryOverrides.set(patch.id, merged);
      toPersist.push(merged);
    }

    if (toClear.length > 0) {
      await this.clearEntryOverrides(toClear);
    }
    if (toPersist.length === 0) return;

    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db.objectStoreNames.contains("entry_overrides")) {
          const tx = db.transaction("entry_overrides", "readwrite");
          const store = tx.objectStore("entry_overrides");
          for (const merged of toPersist) {
            store.put(JSON.parse(JSON.stringify(merged)));
          }
        }
      } catch (err) {
        console.warn("Could not persist entry overrides to IndexedDB:", err);
      }
    }
  }

  private async syncDevCorpusToDisk(
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const isReviewUrl =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("review") === "1";
    if (!import.meta.env.DEV || isTauriEnvironment() || isReviewUrl) {
      return false;
    }
    try {
      const res = await fetch("/__alexis_dev/corpus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Alexis-Dev": "1",
        },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async clearEntryOverrides(ids: string[]) {
    if (ids.length === 0) return;
    for (const id of ids) {
      this.entryOverrides.delete(id);
    }
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db.objectStoreNames.contains("entry_overrides")) {
          const tx = db.transaction("entry_overrides", "readwrite");
          const store = tx.objectStore("entry_overrides");
          for (const id of ids) {
            store.delete(id);
          }
        }
      } catch (err) {
        console.warn("Could not clear entry overrides from IndexedDB:", err);
      }
    }
  }

  private async clearPersistedCorpusBundle(corpusId: string) {
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db.objectStoreNames.contains("corpus_bundles")) {
          const tx = db.transaction("corpus_bundles", "readwrite");
          const store = tx.objectStore("corpus_bundles");
          store.delete(corpusId);
        }
      } catch (err) {
        console.warn("Could not clear bundle from IndexedDB:", err);
      }
    }
  }

  async listCorpora(): Promise<CorpusMeta[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      let corpora = await invoke<CorpusMeta[]>("list_corpora");
      const existingIds = new Set(corpora.map((c) => c.id));
      let seeded = false;
      for (const bundle of this.memoryBundles) {
        if (!existingIds.has(bundle.corpus.id)) {
          await invoke<number>("import_corpus_bundle", { bundle });
          seeded = true;
        }
      }
      if (seeded) {
        corpora = await invoke<CorpusMeta[]>("list_corpora");
      }
      return corpora;
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
        user_note: state.userNote,
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
        // Merge definitions if distinct (or backfill notes)
        for (const def of item.definitions) {
          const matchDef = existing.definitions.find(
            (d) => d.meaning.trim() === def.meaning.trim(),
          );
          if (!matchDef) {
            existing.definitions.push(def);
          } else if (def.notes && !matchDef.notes) {
            matchDef.notes = def.notes;
          }
        }
        // Merge tags
        for (const t of item.tags) {
          if (!existing.tags.includes(t)) {
            existing.tags.push(t);
          }
        }
        if (!existing.user_note && item.user_note) {
          existing.user_note = item.user_note;
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
      userNote: current.userNote,
    };

    await this.persistStudyState(review.entry_id, updated);
    return updated;
  }

  async saveUserNote(
    entryId: string,
    note: string,
  ): Promise<string | undefined> {
    const cleaned = note.trim() || undefined;
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_user_note", { entryId, note: cleaned ?? null });
      return cleaned;
    }
    await this.ensureInitialized();
    const current = this.localStudyState.get(entryId) || {
      box: 1,
      interval: 1,
      successes: 0,
      nextDue: new Date().toISOString(),
    };
    const updated = {
      ...current,
      userNote: cleaned,
    };
    await this.persistStudyState(entryId, updated);
    return cleaned;
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

  async updateEntries(
    corpusId: string,
    patches: EntryPatch[],
  ): Promise<number> {
    if (patches.length === 0) return 0;
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    const patchMap = new Map(patches.map((p) => [p.id, p]));
    let updated = 0;
    if (bundle) {
      for (const entry of bundle.entries) {
        const patch = patchMap.get(entry.id);
        if (!patch) continue;
        applyPatchToEntry(entry, patch);
        updated++;
      }
    }
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<number>("update_corpus_entries", { patches });
    }
    await this.ensureInitialized();
    if (updated > 0) {
      const syncedToDisk = await this.syncDevCorpusToDisk({
        action: "patch",
        corpusId,
        patches,
      });
      if (syncedToDisk) {
        await this.clearEntryOverrides(patches.map((p) => p.id));
      } else {
        await this.persistEntryOverrides(patches);
      }
    }
    return updated;
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
    const colNotes = header.findIndex(
      (h) => h === "notes" || h === "note" || h === "notiz" || h === "notizen",
    );

    const bundle = this.memoryBundles.find(
      (b) => b.corpus.id === targetCorpusId,
    );
    if (!bundle) return 0;

    const usedIds = new Set(bundle.entries.map((e) => e.id));
    const mergedExistingMap = new Map<string, EntryPatch>();
    const isDevGitSync =
      import.meta.env.DEV &&
      !isTauriEnvironment() &&
      !(
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("review") === "1"
      );

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
      const rawNotes = colNotes >= 0 ? parts[colNotes] : "";

      if (!nat || !mng) continue;
      const cleanNat = nat.replace(/\r/g, "").trim();
      const cleanMng = mng.replace(/\r/g, "").trim();
      const cleanTrn = trn.replace(/\r/g, "").trim();
      const cleanNotes = rawNotes ? rawNotes.replace(/\r/g, "").trim() : "";
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
        let changed = false;
        // Merge definition without duplicates (or backfill notes)
        const matchingDef = existing.definitions.find(
          (d) => d.meaning.trim() === cleanMng,
        );
        if (!matchingDef) {
          existing.definitions.push({
            lang: "de",
            meaning: cleanMng,
            ...(cleanNotes ? { notes: cleanNotes } : {}),
          });
          changed = true;
        } else if (cleanNotes && !matchingDef.notes) {
          matchingDef.notes = cleanNotes;
          changed = true;
        }
        // Merge tags
        for (const t of cleanTags) {
          if (!existing.tags?.includes(t)) {
            existing.tags = existing.tags || [];
            existing.tags.push(t);
            changed = true;
          }
        }
        if (!existing.pos && pos) {
          existing.pos = pos.trim();
          changed = true;
        }
        if (!existing.gender && gen && gen !== "-") {
          existing.gender = gen.trim();
          changed = true;
        }
        if (changed) {
          mergedExistingMap.set(existing.id, {
            id: existing.id,
            lemma_native: existing.lemma_native,
            lemma_translit: existing.lemma_translit,
            pos: existing.pos ?? null,
            gender: existing.gender ?? null,
            definitions: existing.definitions.map((d) => ({ ...d })),
            tags: [...(existing.tags ?? [])],
          });
          count++;
        }
      } else {
        let seq =
          bundle.entries.filter((e) => e.lesson_id === lessonId).length + 1;
        const idPrefix = isDevGitSync ? lessonId : `usr_${lessonId}`;
        let id = `${idPrefix}_${String(seq).padStart(3, "0")}`;
        while (usedIds.has(id)) {
          seq++;
          id = `${idPrefix}_${String(seq).padStart(3, "0")}`;
        }
        usedIds.add(id);
        bundle.entries.push({
          id,
          corpus_id: targetCorpusId,
          volume_id: vol,
          lesson_id: lessonId,
          lemma_native: cleanNat,
          lemma_translit: cleanTrn,
          pos: pos ? pos.trim() : undefined,
          gender: gen && gen !== "-" ? gen.trim() : undefined,
          definitions: [
            {
              lang: "de",
              meaning: cleanMng,
              ...(cleanNotes ? { notes: cleanNotes } : {}),
            },
          ],
          tags: cleanTags,
        });
        count++;
      }
    }

    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("import_corpus_bundle", { bundle });
    } else {
      const syncedToDisk = await this.syncDevCorpusToDisk({
        action: "save_bundle",
        corpusId: targetCorpusId,
        bundle,
      });
      if (syncedToDisk) {
        await this.clearPersistedCorpusBundle(targetCorpusId);
        if (mergedExistingMap.size > 0) {
          await this.clearEntryOverrides(Array.from(mergedExistingMap.keys()));
        }
      } else {
        await this.persistCorpusBundle(targetCorpusId, bundle);
        if (mergedExistingMap.size > 0) {
          await this.persistEntryOverrides(
            Array.from(mergedExistingMap.values()),
          );
        }
      }
    }
    return count;
  }

  async exportSelectionTSV(
    corpusId: string,
    volumeIds?: string[],
    lessonIds?: string[],
  ): Promise<string> {
    await this.ensureInitialized();
    const bundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    if (!bundle) return "";

    let userNoteMap: Record<string, { userNote?: string }> = {};
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        userNoteMap =
          await invoke<Record<string, { userNote?: string }>>(
            "export_study_state",
          );
      } catch {
        userNoteMap = {};
      }
    } else {
      for (const [key, val] of this.localStudyState.entries()) {
        if (val.userNote) {
          userNoteMap[key] = { userNote: val.userNote };
        }
      }
    }

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
      "volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags\tnotes";
    const rows = entries.map((e) => {
      const les = bundle.lessons.find((l) => l.id === e.lesson_id);
      const lesNum = les
        ? String(les.lesson_number)
        : e.lesson_id
          ? e.lesson_id.replace(/^.*_l0?/, "")
          : "1";
      const mean = e.definitions
        .map((d) => sanitizeTsvField(d.meaning))
        .join("; ");
      const tags = (e.tags || [])
        .map((t) => sanitizeTsvField(t))
        .filter(Boolean)
        .join(";");
      const notes = formatCombinedNotes(
        e.definitions,
        userNoteMap[e.id]?.userNote,
      );
      return [
        sanitizeTsvField(e.volume_id),
        sanitizeTsvField(lesNum),
        sanitizeTsvField(e.lemma_native),
        sanitizeTsvField(e.lemma_translit),
        sanitizeTsvField(e.pos || ""),
        sanitizeTsvField(e.gender || "-"),
        mean,
        tags,
        notes,
      ].join("\t");
    });

    return [header, ...rows].join("\n");
  }

  getCorpusBundle(corpusId: string): CorpusBundle | undefined {
    return this.memoryBundles.find((b) => b.corpus.id === corpusId);
  }

  getEntryOverride(entryId: string): EntryPatch | undefined {
    return this.entryOverrides.get(entryId);
  }

  async getReviewDelta(
    corpusId: string,
    liveItems?: StudyCardItem[],
  ): Promise<ReviewDeltaDocument> {
    await this.ensureInitialized();
    const canonicalBundle = CANONICAL_BUNDLES.find(
      (b) => b.corpus.id === corpusId,
    );
    const liveBundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    const canonicalMap = new Map(
      (canonicalBundle?.entries ?? []).map((e) => [e.id, e]),
    );
    const changes: ReviewDeltaItem[] = [];

    if (!isTauriEnvironment()) {
      for (const entry of liveBundle?.entries ?? []) {
        const ov = this.entryOverrides.get(entry.id);
        if (!ov) continue;
        const base = canonicalMap.get(entry.id);
        const before = base ? toEntrySnapshot(base) : toEntrySnapshot(entry);
        const after = toEntrySnapshot(entry);
        const comment = ov.reviewer_comment?.trim() || undefined;
        if (!snapshotsEqual(before, after) || comment) {
          changes.push({
            id: entry.id,
            volume_id: entry.volume_id,
            lesson_id: entry.lesson_id ?? null,
            before,
            after,
            ...(comment ? { reviewer_comment: comment } : {}),
          });
        }
      }
    } else {
      const lemmaCounts = new Map<string, number>();
      for (const ce of canonicalBundle?.entries ?? []) {
        const k = ce.lemma_native.trim();
        lemmaCounts.set(k, (lemmaCounts.get(k) ?? 0) + 1);
      }
      for (const item of liveItems ?? []) {
        const base = canonicalMap.get(item.entry_id);
        if (!base) continue;
        if ((lemmaCounts.get(base.lemma_native.trim()) ?? 0) > 1) continue;
        const before = toEntrySnapshot(base);
        const after = toEntrySnapshot(item);
        if (!snapshotsEqual(before, after)) {
          changes.push({
            id: item.entry_id,
            volume_id: item.volume_id,
            lesson_id: item.lesson_id ?? null,
            before,
            after,
          });
        }
      }
    }

    return {
      schema: "alexis-review-delta-v1",
      corpus_id: corpusId,
      corpus_title:
        liveBundle?.corpus.title ?? canonicalBundle?.corpus.title ?? corpusId,
      exported_at: new Date().toISOString(),
      changes,
    };
  }

  async resetCorpusOverrides(corpusId: string): Promise<void> {
    await this.ensureInitialized();
    const canonicalBundle = CANONICAL_BUNDLES.find(
      (b) => b.corpus.id === corpusId,
    );
    const liveBundle = this.memoryBundles.find((b) => b.corpus.id === corpusId);
    if (!liveBundle) return;

    const canonicalMap = new Map(
      (canonicalBundle?.entries ?? []).map((e) => [e.id, e]),
    );
    const idsToClear: string[] = [];

    for (let i = 0; i < liveBundle.entries.length; i++) {
      const entry = liveBundle.entries[i];
      if (this.entryOverrides.has(entry.id)) {
        idsToClear.push(entry.id);
        const base = canonicalMap.get(entry.id);
        if (base) {
          liveBundle.entries[i] = JSON.parse(JSON.stringify(base));
        }
      }
    }

    await this.clearEntryOverrides(idsToClear);
  }

  getLastBackupMeta(): LastBackupMeta | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LastBackupMeta>;
      if (
        typeof parsed?.timestamp !== "string" ||
        typeof parsed?.filename !== "string"
      ) {
        return null;
      }
      return {
        timestamp: parsed.timestamp,
        filename: parsed.filename,
        studyEntriesCount: Number(parsed.studyEntriesCount) || 0,
        overridesCount: Number(parsed.overridesCount) || 0,
        customEntriesCount: Number(parsed.customEntriesCount) || 0,
      };
    } catch {
      return null;
    }
  }

  setLastBackupMeta(meta: LastBackupMeta): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LAST_BACKUP_STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // ignore storage quota restrictions
    }
  }

  async exportStudyBackup(): Promise<FullStudyBackupDocument> {
    const study_state: Record<string, StudyStateBackupEntry> = {};
    let entry_overrides: EntryPatch[] = [];
    let custom_corpora: CustomCorpusAddition[] = [];

    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      const rawStates =
        await invoke<Record<string, StudyStateBackupEntry>>(
          "export_study_state",
        );
      for (const [key, val] of Object.entries(rawStates)) {
        study_state[key] = {
          box: val.box,
          interval: val.interval,
          successes: val.successes,
          nextDue: normalizeToIsoTimestamp(val.nextDue),
          ...(typeof val.reviewCount === "number"
            ? { reviewCount: val.reviewCount }
            : {}),
          ...(val.userNote ? { userNote: val.userNote } : {}),
        };
      }
      const sqliteBundles = await invoke<CorpusBundle[]>(
        "export_corpus_bundles",
      );
      const diffs = extractCorpusDiffs(sqliteBundles);
      entry_overrides = diffs.entry_overrides;
      custom_corpora = diffs.custom_corpora;
    } else {
      await this.ensureInitialized();
      for (const [key, val] of this.localStudyState.entries()) {
        study_state[key] = {
          box: val.box,
          interval: val.interval,
          successes: val.successes,
          nextDue: normalizeToIsoTimestamp(val.nextDue),
          ...(val.userNote ? { userNote: val.userNote } : {}),
        };
      }
      const diffs = extractCorpusDiffs(this.memoryBundles, this.entryOverrides);
      entry_overrides = diffs.entry_overrides;
      custom_corpora = diffs.custom_corpora;
    }

    return {
      schema: "alexis-backup-v2",
      created_at: new Date().toISOString(),
      study_state,
      ...(entry_overrides.length > 0 ? { entry_overrides } : {}),
      ...(custom_corpora.length > 0 ? { custom_corpora } : {}),
    };
  }

  async inspectStudyBackup(rawPayload: unknown): Promise<BackupInspection> {
    if (!isPlainObject(rawPayload)) {
      throw new Error("Ungültiges Backup-Format (JSON-Objekt erwartet).");
    }

    const obj = rawPayload;
    if (obj.schema === "alexis-review-delta-v1") {
      throw new Error(
        "Dies ist ein Gutachter-Delta, kein Lernstand-Backup. Bitte „📥 Delta prüfen“ in der Vokabelliste nutzen.",
      );
    }

    if ("corpus" in obj && ("volumes" in obj || "entries" in obj)) {
      throw new Error(
        "Dies ist eine Korpus-Datei, kein Lernstand-Backup. Bitte über „Korpus hochladen“ oder die Vokabelliste importieren.",
      );
    }

    const isV2 = obj.schema === "alexis-backup-v2";
    if (!isV2 && obj.schema !== undefined) {
      throw new Error(`Unbekanntes Backup-Schema: ${String(obj.schema)}.`);
    }

    if (isV2 && !isPlainObject(obj.study_state)) {
      throw new Error(
        "Ungültiges v2-Backup: 'study_state' fehlt oder ist ungültig.",
      );
    }

    const rawStudyState: Record<string, unknown> = isV2
      ? (obj.study_state as Record<string, unknown>)
      : obj;

    const studyEntries = Object.entries(rawStudyState);
    if (!isV2 && studyEntries.length === 0) {
      throw new Error("Die Backup-Datei enthält keine Lernstände.");
    }

    const studyState: Record<string, StudyStateBackupEntry> = {};
    for (const [entryId, val] of studyEntries) {
      if (!entryId.trim() || !isPlainObject(val)) {
        throw new Error(
          `Ungültiger Lernstand-Eintrag für ID '${entryId || "?"}'.`,
        );
      }
      if (typeof val.box !== "number" || !Number.isFinite(val.box)) {
        throw new Error(
          `Ungültiger Leitner-Status für ID '${entryId}': numerisches Feld 'box' fehlt.`,
        );
      }
      const box = Math.min(5, Math.max(1, Math.round(val.box)));
      const interval =
        typeof val.interval === "number" && Number.isFinite(val.interval)
          ? Math.max(1, Math.round(val.interval))
          : 1;
      const successes =
        typeof val.successes === "number" && Number.isFinite(val.successes)
          ? Math.max(0, Math.round(val.successes))
          : 0;
      const reviewCount =
        typeof val.reviewCount === "number" && Number.isFinite(val.reviewCount)
          ? Math.max(0, Math.round(val.reviewCount))
          : undefined;
      const nextDue = normalizeToIsoTimestamp(val.nextDue);
      const userNote =
        typeof val.userNote === "string" && val.userNote.trim()
          ? val.userNote.trim()
          : undefined;

      studyState[entryId] = {
        box,
        interval,
        successes,
        nextDue,
        ...(reviewCount !== undefined ? { reviewCount } : {}),
        ...(userNote ? { userNote } : {}),
      };
    }

    const entryOverrides: EntryPatch[] = [];
    if (isV2 && obj.entry_overrides !== undefined) {
      if (!Array.isArray(obj.entry_overrides)) {
        throw new Error(
          "Ungültiges v2-Backup: 'entry_overrides' muss ein Array sein.",
        );
      }
      for (const patch of obj.entry_overrides) {
        if (
          !isPlainObject(patch) ||
          typeof patch.id !== "string" ||
          !patch.id.trim() ||
          typeof patch.lemma_native !== "string" ||
          typeof patch.lemma_translit !== "string"
        ) {
          throw new Error(
            "Ungültiges v2-Backup: 'entry_overrides' enthält ungültige Einträge.",
          );
        }
        entryOverrides.push(patch as EntryPatch);
      }
    }

    const customCorpora: CustomCorpusAddition[] = [];
    if (isV2 && obj.custom_corpora !== undefined) {
      if (!Array.isArray(obj.custom_corpora)) {
        throw new Error(
          "Ungültiges v2-Backup: 'custom_corpora' muss ein Array sein.",
        );
      }
      for (const addition of obj.custom_corpora) {
        if (
          !isPlainObject(addition) ||
          typeof addition.corpus_id !== "string" ||
          !addition.corpus_id.trim()
        ) {
          throw new Error(
            "Ungültiges v2-Backup: 'custom_corpora' ist beschädigt.",
          );
        }
        const volumes = addition.volumes ?? [];
        const lessons = addition.lessons ?? [];
        const entries = addition.entries ?? [];
        if (
          !Array.isArray(volumes) ||
          !Array.isArray(lessons) ||
          !Array.isArray(entries) ||
          volumes.some((v) => !isPlainObject(v) || typeof v.id !== "string") ||
          lessons.some((l) => !isPlainObject(l) || typeof l.id !== "string") ||
          entries.some(
            (e) =>
              !isPlainObject(e) ||
              typeof e.id !== "string" ||
              typeof e.lemma_native !== "string",
          )
        ) {
          throw new Error(
            `Ungültiges v2-Backup: ungültige Struktur in custom_corpora ('${addition.corpus_id}').`,
          );
        }
        if (
          addition.corpus_meta !== undefined &&
          (!isPlainObject(addition.corpus_meta) ||
            typeof addition.corpus_meta.id !== "string" ||
            typeof addition.corpus_meta.title !== "string")
        ) {
          throw new Error(
            `Ungültiges v2-Backup: ungültige Metadaten für '${addition.corpus_id}'.`,
          );
        }
        customCorpora.push({
          corpus_id: addition.corpus_id,
          ...(addition.corpus_meta
            ? { corpus_meta: addition.corpus_meta as CorpusMeta }
            : {}),
          volumes: volumes as VolumeData[],
          lessons: lessons as LessonData[],
          entries: entries as CorpusBundle["entries"],
        });
      }
    }

    await this.ensureInitialized();
    const knownEntryIds = new Set<string>();
    if (isTauriEnvironment()) {
      const { invoke } = await import("@tauri-apps/api/core");
      const sqliteBundles = await invoke<CorpusBundle[]>(
        "export_corpus_bundles",
      );
      for (const b of sqliteBundles) {
        for (const e of b.entries) knownEntryIds.add(e.id);
      }
    } else {
      for (const b of this.memoryBundles) {
        for (const e of b.entries) knownEntryIds.add(e.id);
      }
    }
    let customEntriesCount = 0;
    for (const c of customCorpora) {
      for (const e of c.entries) {
        if (!knownEntryIds.has(e.id)) {
          knownEntryIds.add(e.id);
          customEntriesCount++;
        }
      }
    }

    const totalStudyCount = Object.keys(studyState).length;
    let applicableStudyCount = 0;
    for (const entryId of Object.keys(studyState)) {
      if (knownEntryIds.has(entryId)) applicableStudyCount++;
    }

    return {
      schemaVersion: isV2 ? "v2" : "v1",
      createdAt: typeof obj.created_at === "string" ? obj.created_at : null,
      totalStudyCount,
      applicableStudyCount,
      skippedStudyCount: totalStudyCount - applicableStudyCount,
      overridesCount: entryOverrides.length,
      customCorporaCount: customCorpora.length,
      customEntriesCount,
      studyState,
      entryOverrides,
      customCorpora,
    };
  }

  async importStudyBackup(rawPayload: unknown): Promise<{
    restoredStudyCount: number;
    restoredOverridesCount: number;
    restoredCustomEntriesCount: number;
  }> {
    const inspected = await this.inspectStudyBackup(rawPayload);

    let restoredCustomEntriesCount = 0;
    let restoredOverridesCount = 0;

    // 1. Restore custom corpora / custom TSV entries (delta-only so canonical overrides stay untouched)
    for (const addition of inspected.customCorpora) {
      let bundle = this.memoryBundles.find(
        (b) => b.corpus.id === addition.corpus_id,
      );
      let isNewCorpus = false;
      if (!bundle && addition.corpus_meta) {
        bundle = {
          corpus: addition.corpus_meta,
          volumes: [],
          lessons: [],
          entries: [],
        };
        this.memoryBundles.push(bundle);
        isNewCorpus = true;
      }
      if (!bundle) continue;

      const deltaVolumes: VolumeData[] = [];
      const volIds = new Set(bundle.volumes.map((v) => v.id));
      for (const v of addition.volumes) {
        if (!volIds.has(v.id)) {
          bundle.volumes.push(v);
          volIds.add(v.id);
          deltaVolumes.push(v);
        }
      }

      const deltaLessons: LessonData[] = [];
      const lesIds = new Set(bundle.lessons.map((l) => l.id));
      for (const l of addition.lessons) {
        if (!lesIds.has(l.id)) {
          bundle.lessons.push(l);
          lesIds.add(l.id);
          deltaLessons.push(l);
        }
      }

      const deltaEntries: CorpusBundle["entries"] = [];
      const entryIds = new Set(bundle.entries.map((e) => e.id));
      for (const entry of addition.entries) {
        if (!entryIds.has(entry.id)) {
          bundle.entries.push(entry);
          entryIds.add(entry.id);
          deltaEntries.push(entry);
          restoredCustomEntriesCount++;
        }
      }

      if (
        isNewCorpus ||
        deltaVolumes.length > 0 ||
        deltaLessons.length > 0 ||
        deltaEntries.length > 0
      ) {
        if (isTauriEnvironment()) {
          const { invoke } = await import("@tauri-apps/api/core");
          const deltaBundle: CorpusBundle = {
            corpus: addition.corpus_meta ?? bundle.corpus,
            volumes: deltaVolumes,
            lessons: deltaLessons,
            entries: deltaEntries,
          };
          await invoke("import_corpus_bundle", { bundle: deltaBundle });
        } else {
          await this.persistCorpusBundle(bundle.corpus.id, bundle);
        }
      }
    }

    // 2. Restore entry overrides
    if (inspected.entryOverrides.length > 0) {
      const patchMap = new Map(inspected.entryOverrides.map((p) => [p.id, p]));
      for (const bundle of this.memoryBundles) {
        for (const entry of bundle.entries) {
          const p = patchMap.get(entry.id);
          if (p) {
            applyPatchToEntry(entry, p);
            restoredOverridesCount++;
          }
        }
      }
      if (isTauriEnvironment()) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("update_corpus_entries", {
          patches: inspected.entryOverrides,
        });
      } else {
        await this.persistEntryOverrides(inspected.entryOverrides);
      }
    }

    // 3. Restore Leitner study state & user notes
    let restoredStudyCount = 0;
    if (Object.keys(inspected.studyState).length > 0) {
      if (isTauriEnvironment()) {
        const { invoke } = await import("@tauri-apps/api/core");
        restoredStudyCount = await invoke<number>("import_study_state", {
          states: inspected.studyState,
        });
      } else {
        const validEntryIds = new Set(
          this.memoryBundles.flatMap((b) => b.entries.map((e) => e.id)),
        );
        for (const [entryId, state] of Object.entries(inspected.studyState)) {
          if (!validEntryIds.has(entryId)) continue;
          const existing = this.localStudyState.get(entryId);
          const mergedNote = state.userNote ?? existing?.userNote;
          await this.persistStudyState(entryId, {
            box: state.box,
            interval: state.interval,
            successes: state.successes,
            nextDue: normalizeToIsoTimestamp(state.nextDue),
            ...(mergedNote ? { userNote: mergedNote } : {}),
          });
          restoredStudyCount++;
        }
      }
    }

    return {
      restoredStudyCount,
      restoredOverridesCount,
      restoredCustomEntriesCount,
    };
  }
}

export function formatCombinedNotes(
  definitions: EntryDefinition[],
  userNote?: string | null,
): string {
  const parts: string[] = [];
  for (const d of definitions) {
    const clean = sanitizeTsvField(d.notes);
    if (clean && !parts.includes(clean)) {
      parts.push(clean);
    }
  }
  const cleanUser = sanitizeTsvField(userNote);
  if (cleanUser && !parts.includes(cleanUser)) {
    parts.push(cleanUser);
  }
  return parts.join(" · ");
}

export function sanitizeTsvField(val: string | null | undefined): string {
  if (!val) return "";
  return val.replace(/[\r\n\t]+/g, " ").trim();
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
