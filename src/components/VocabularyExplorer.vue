<template>
  <section class="vocabulary-explorer">
    <!-- Explorer Header & Summary -->
    <div class="explorer-header">
      <div class="header-titles">
        <h2>Vokabel-Explorer & Gesamtschau</h2>
        <p class="header-desc">
          Vollständiges Verzeichnis aller Vokabeln für <strong>{{ corpusTitle }}</strong>.
          Durchsuchen, filtern und studieren ohne Bewertungszwang.
        </p>
      </div>

      <!-- Quick Action: Practice filtered set in Trainer -->
      <div class="header-actions">
        <button
          class="btn-practice-selection"
          :disabled="filteredEntries.length === 0"
          @click="practiceFilteredSelection"
          title="Startet eine gezielte Lerneinheit mit genau diesen gefilterten Vokabeln"
        >
          ▶️ Diese Auswahl im Trainer üben ({{ filteredEntries.length }})
        </button>
        <button
          class="btn-copy-tsv"
          :disabled="filteredEntries.length === 0"
          @click="downloadFilteredTSV"
          title="Lädt die gefilterte Liste als .tsv-Datei herunter"
        >
          📥 TSV herunterladen
        </button>
        <button
          class="btn-copy-tsv"
          :disabled="filteredEntries.length === 0"
          @click="copyAsTSV"
          title="Kopiert die aktuelle Liste tabellarisch in die Zwischenablage"
        >
          {{ copyStatus ? '✓ Kopiert!' : '📋 Als TSV kopieren' }}
        </button>
      </div>
    </div>

    <!-- Filter Control Bar -->
    <div class="filter-toolbar">
      <!-- Search Input -->
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Suchen nach Devanagari, IAST, Harvard-Kyoto (z.B. kRSNa), Deutsch…"
          class="search-input"
          autofocus
        />
        <button
          v-if="searchQuery"
          class="translit-convert-btn"
          @click="toggleSearchTransliteration"
          title="Suchbegriff zwischen Devanagari und Umschrift (IAST/HK) konvertieren"
        >
          अ ⇄ a
        </button>
        <button
          v-if="searchQuery"
          class="clear-search-btn"
          @click="searchQuery = ''"
          title="Suche zurücksetzen"
        >
          ✕
        </button>
      </div>

      <!-- Scope Filter: Selection vs All -->
      <div class="filter-group">
        <label class="filter-label">Umfang:</label>
        <div class="pill-group">
          <button
            :class="['pill-btn', { active: scopeMode === 'selected' }]"
            @click="scopeMode = 'selected'"
          >
            Aktive Gliederung ({{ activeSelectionLabel }})
          </button>
          <button
            :class="['pill-btn', { active: scopeMode === 'all' }]"
            @click="scopeMode = 'all'"
          >
            Gesamtes Korpus
          </button>
        </div>
      </div>

      <!-- Volume / Lesson Filter when in 'all' or refining -->
      <div class="filter-group" v-if="volumesList.length > 1">
        <label class="filter-label">Band:</label>
        <select v-model="filterVolumeId" class="filter-select">
          <option value="">Alle Bände</option>
          <option v-for="vol in volumesList" :key="vol.id" :value="vol.id">
            {{ vol.title }}
          </option>
        </select>
      </div>

      <div class="filter-group" v-if="availableLessons.length > 0">
        <label class="filter-label">Lektion:</label>
        <select v-model="filterLessonId" class="filter-select">
          <option value="">Alle Lektionen</option>
          <option v-for="les in availableLessons" :key="les.id" :value="les.id">
            {{ formatLessonOption(les) }}
          </option>
        </select>
      </div>

      <!-- Leitner Box Filter -->
      <div class="filter-group">
        <label class="filter-label">Box / Status:</label>
        <div class="pill-group">
          <button
            :class="['pill-btn', { active: filterBox === null }]"
            @click="filterBox = null"
          >
            Alle
          </button>
          <button
            v-for="b in [1, 2, 3, 4, 5]"
            :key="b"
            :class="['pill-btn', `box-pill-${b}`, { active: filterBox === b }]"
            @click="filterBox = filterBox === b ? null : b"
          >
            Box {{ b }}
          </button>
          <button
            :class="['pill-btn', 'box-pill-due', { active: filterDueOnly }]"
            @click="filterDueOnly = !filterDueOnly"
            title="Zeigt nur Vokabeln, deren Spaced-Repetition-Intervall heute fällig ist"
          >
            Fällig heute
          </button>
        </div>
      </div>

      <!-- Part of Speech Filter -->
      <div class="filter-group">
        <label class="filter-label">Wortart:</label>
        <div class="pill-group">
          <button
            :class="['pill-btn', { active: filterPos === '' }]"
            @click="filterPos = ''"
          >
            Alle
          </button>
          <button
            :class="['pill-btn', { active: filterPos === 'noun' }]"
            @click="filterPos = filterPos === 'noun' ? '' : 'noun'"
          >
            Substantive
          </button>
          <button
            :class="['pill-btn', { active: filterPos === 'verb' }]"
            @click="filterPos = filterPos === 'verb' ? '' : 'verb'"
          >
            Verben
          </button>
          <button
            :class="['pill-btn', { active: filterPos === 'adj' }]"
            @click="filterPos = filterPos === 'adj' ? '' : 'adj'"
          >
            Adjektive
          </button>
          <button
            :class="['pill-btn', { active: filterPos === 'other' }]"
            @click="filterPos = filterPos === 'other' ? '' : 'other'"
          >
            Andere
          </button>
        </div>
      </div>

      <!-- Sort Order -->
      <div class="filter-group">
        <label class="filter-label">Sortierung:</label>
        <select v-model="sortOrder" class="filter-select">
          <option value="curriculum">Lehrwerk (Band & Lektion)</option>
          <option value="deva-asc">Devanagari (अ ➔ ह)</option>
          <option value="translit-asc">IAST Umschrift (A ➔ Z)</option>
          <option value="meaning-asc">Deutsche Bedeutung (A ➔ Z)</option>
          <option value="box-asc">Lernstatus (Box 1 zuerst)</option>
          <option value="box-desc">Lernstatus (Box 5 zuerst)</option>
        </select>
      </div>
    </div>

    <!-- Active Filter Counter & Quick Reset -->
    <div class="results-meta-bar">
      <div class="meta-count">
        Gefunden: <strong>{{ filteredEntries.length }}</strong> von {{ allEntries.length }} Vokabeln
        <span v-if="activeFilterCount > 0" class="active-filter-badge">
          ({{ activeFilterCount }} Filter aktiv)
        </span>
      </div>

      <div class="meta-actions" v-if="activeFilterCount > 0">
        <button class="btn-text-link" @click="resetFilters">
          Filter zurücksetzen
        </button>
      </div>
    </div>

    <!-- Table Container -->
    <div class="table-card">
      <div v-if="loading" class="empty-state">
        <div class="loading-spinner"></div>
        <p>Lade Vokabelbestand…</p>
      </div>

      <div v-else-if="filteredEntries.length === 0" class="empty-state">
        <span class="empty-icon">🔍</span>
        <h3>Keine Vokabeln gefunden</h3>
        <p>Passe die Suchkriterien oder Filter an, um Einträge anzuzeigen.</p>
        <button class="btn-outline-sm" @click="resetFilters">Filter leeren</button>
      </div>

      <div v-else class="table-responsive">
        <table class="scholarly-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-native">Devanāgarī</th>
              <th class="col-translit">IAST Umschrift</th>
              <th class="col-grammar">Grammatik</th>
              <th class="col-meaning">Bedeutung (Deutsch)</th>
              <th class="col-origin">Gliederung</th>
              <th class="col-box">Status</th>
              <th class="col-actions">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in filteredEntries"
              :key="item.entry_id"
              class="table-row"
              :class="{ 'row-active': selectedEntry?.entry_id === item.entry_id }"
              @click="toggleEntryDetail(item)"
            >
              <td class="col-num">{{ idx + 1 }}</td>
              <td class="col-native script-deva">
                <div class="native-lemma-row">
                  <span class="lemma-highlight">{{ item.lemma_native }}</span>
                  <button
                    class="btn-table-speak"
                    @click.stop="speakItem(item)"
                    title="Aussprache anhören"
                  >
                    🔊
                  </button>
                </div>
              </td>
              <td class="col-translit">
                <span class="translit-text">{{ item.lemma_translit }}</span>
              </td>
              <td class="col-grammar">
                <div class="grammar-badges">
                  <span v-if="item.pos" class="pos-badge">
                    {{ formatPosShort(item.pos) }}
                  </span>
                  <span
                    v-if="item.gender && item.gender !== '-'"
                    :class="['gender-badge', `gender-${item.gender.toLowerCase().replace('/', '-')}`]"
                  >
                    {{ item.gender }}.
                  </span>
                </div>
              </td>
              <td class="col-meaning">
                <div class="meaning-text">
                  {{ formatMeanings(item) }}
                </div>
                <div v-if="item.tags && item.tags.length > 0" class="item-tags">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag-pill">
                    #{{ tag }}
                  </span>
                </div>
              </td>
              <td class="col-origin">
                <span class="origin-label">
                  {{ formatLessonLabel(item) }}
                </span>
              </td>
              <td class="col-box">
                <span :class="['box-badge', `box-${item.box_number}`]" :title="`Box ${item.box_number} (Intervall: ${item.interval_days} Tage)`">
                  Box {{ item.box_number }}
                </span>
                <span v-if="isDue(item)" class="due-dot" title="Heute fällig">●</span>
              </td>
              <td class="col-actions" @click.stop>
                <button
                  class="btn-inspect"
                  @click="toggleEntryDetail(item)"
                  title="Morphologie & Details ansehen"
                >
                  {{ selectedEntry?.entry_id === item.entry_id ? '▲' : 'ℹ︎' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Drawer / Modal for selected entry -->
    <div v-if="selectedEntry" class="detail-modal-backdrop" @click="selectedEntry = null">
      <div class="detail-modal-card" @click.stop>
        <div class="modal-header">
          <div class="modal-lemma-block">
            <span class="modal-native script-deva">{{ selectedEntry.lemma_native }}</span>
            <span class="modal-translit">{{ selectedEntry.lemma_translit }}</span>
            <button
              class="btn-modal-speak"
              @click.stop="speakItem(selectedEntry)"
              title="Aussprache anhören"
            >
              🔊
            </button>
          </div>
          <button class="modal-close-btn" @click="selectedEntry = null" title="Schließen">✕</button>
        </div>

        <div class="modal-body">
          <!-- Meta & Meanings -->
          <div class="modal-section">
            <div class="modal-meta-row">
              <span v-if="selectedEntry.pos" class="pos-badge-lg">
                {{ formatPosFull(selectedEntry.pos) }}
              </span>
              <span
                v-if="selectedEntry.gender && selectedEntry.gender !== '-'"
                :class="['gender-badge-lg', `gender-${selectedEntry.gender.toLowerCase().replace('/', '-')}`]"
              >
                {{ formatGenderFull(selectedEntry.gender) }}
              </span>
              <span class="lesson-badge-lg">
                {{ selectedEntry.volume_title }} · {{ getLessonTitle(selectedEntry.lesson_id) }}
              </span>
              <span :class="['box-badge-lg', `box-${selectedEntry.box_number}`]">
                Box {{ selectedEntry.box_number }} (Intervall: {{ selectedEntry.interval_days }} Tage)
              </span>
            </div>

            <div class="modal-meanings">
              <h4>Bedeutung(en):</h4>
              <ul class="meanings-list">
                <li v-for="(def, dIdx) in selectedEntry.definitions" :key="dIdx">
                  <strong>{{ def.meaning }}</strong>
                  <span v-if="def.notes" class="def-notes">({{ def.notes }})</span>
                </li>
              </ul>
            </div>

            <div v-if="selectedEntry.tags && selectedEntry.tags.length > 0" class="modal-tags">
              <span v-for="tag in selectedEntry.tags" :key="tag" class="tag-pill-lg">
                #{{ tag }}
              </span>
            </div>
          </div>

          <!-- Hindi Morphology Paradigm if applicable -->
          <div v-if="isHindi && nounDeclension" class="modal-section morphology-section">
            <div class="morphology-header">
              <h4>📖 Substantiv-Deklination: {{ nounDeclension.declensionType }}</h4>
              <p class="paradigm-rule-note">{{ nounDeclension.ruleExplanation }}</p>
            </div>
            <div class="table-responsive">
              <table class="paradigm-table">
                <thead>
                  <tr>
                    <th>Kasus</th>
                    <th>Singular</th>
                    <th>Plural</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in nounDeclension.rows" :key="row.kasus">
                    <td>
                      <strong>{{ row.kasus }}</strong>
                      <span v-if="row.kasusHelp" class="kasus-sub"> ({{ row.kasusHelp }})</span>
                    </td>
                    <td class="script-deva">
                      {{ row.sgNative }}
                      <span class="translit-inline">({{ row.sgTranslit }})</span>
                    </td>
                    <td class="script-deva">
                      {{ row.plNative }}
                      <span class="translit-inline">({{ row.plTranslit }})</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="nounDeclension.postpositionNote" class="paradigm-rule-note">
              Hinweis: {{ nounDeclension.postpositionNote }}
            </p>
          </div>

          <!-- Verb Paradigm -->
          <div v-if="isHindi && verbParadigm" class="modal-section morphology-section">
            <h4>⚡ Verb-Paradigmen & Stämme (Hindi)</h4>
            <div class="verb-stems-grid">
              <div class="stem-card">
                <span class="stem-label">Wurzel / Stamm:</span>
                <span class="script-deva stem-val">{{ verbParadigm.rootNative }}</span>
                <span class="translit-inline">({{ verbParadigm.rootTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Habitual (Präsens):</span>
                <span class="script-deva stem-val">{{ verbParadigm.habitNative }}</span>
                <span class="translit-inline">({{ verbParadigm.habitTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Perfektpartizip:</span>
                <span class="script-deva stem-val">{{ verbParadigm.perfNative }}</span>
                <span class="translit-inline">({{ verbParadigm.perfTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Futur (3. Sg.):</span>
                <span class="script-deva stem-val">{{ verbParadigm.futNative }}</span>
                <span class="translit-inline">({{ verbParadigm.futTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Imperativ (आप):</span>
                <span class="script-deva stem-val">{{ verbParadigm.impNative }}</span>
                <span class="translit-inline">({{ verbParadigm.impTranslit }})</span>
              </div>
            </div>
            <div class="ergative-notice">
              <span class="ne-badge">{{ verbParadigm.neBadge }}</span>
              {{ verbParadigm.neExplanation }}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-primary" @click="practiceSingleEntry(selectedEntry)">
            ▶️ Diese Vokabel im Trainer üben
          </button>
          <button class="btn-outline" @click="selectedEntry = null">
            Schließen
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  type HindiNounDeclension,
  type HindiVerbParadigm,
  getHindiNounDeclension,
  getHindiVerbParadigm,
} from "../services/hindiMorphology";
import { speechService } from "../services/speech";
import { downloadTSV, storage } from "../services/storage";
import {
  containsDevanagari,
  devanagariToHk,
  devanagariToIast,
  hkToDevanagari,
  hkToDevanagariSync,
  hkToIast,
  iastToDevanagari,
  toggleTransliteration,
} from "../services/transliteration";
import type { LessonData, StudyCardItem, VolumeData } from "../types";

const props = defineProps<{
  corpusId: string;
  corpusTitle: string;
  isHindi: boolean;
  volumesList: VolumeData[];
  lessonsList: LessonData[];
  selectedVolumeIds: string[];
  selectedLessonIds: string[];
}>();

const emit = defineEmits<{
  (e: "practice-selection", items: StudyCardItem[]): void;
  (e: "switch-tab", tab: string): void;
}>();

// State
const loading = ref(false);
const allEntries = ref<StudyCardItem[]>([]);
const selectedEntry = ref<StudyCardItem | null>(null);

// Filters
const searchQuery = ref("");
const scopeMode = ref<"selected" | "all">("selected");
const filterVolumeId = ref("");
const filterLessonId = ref("");
const filterBox = ref<number | null>(null);
const filterDueOnly = ref(false);
const filterPos = ref("");
const sortOrder = ref<
  | "curriculum"
  | "deva-asc"
  | "translit-asc"
  | "meaning-asc"
  | "box-asc"
  | "box-desc"
>("curriculum");

const copyStatus = ref(false);

// Active selection label
const activeSelectionLabel = computed(() => {
  if (props.selectedLessonIds.length > 0) {
    return `${props.selectedLessonIds.length} Lektionen`;
  }
  if (props.selectedVolumeIds.length === 0) return "Keine";
  if (props.selectedVolumeIds.length === props.volumesList.length) {
    return "Alle Bände";
  }
  return `${props.selectedVolumeIds.length} Bände`;
});

// Available lessons based on filterVolumeId or active scope
const availableLessons = computed(() => {
  let list = props.lessonsList.filter((l) => (l.entry_count ?? 0) > 0);
  if (filterVolumeId.value) {
    list = list.filter((l) => l.volume_id === filterVolumeId.value);
  } else if (
    scopeMode.value === "selected" &&
    props.selectedVolumeIds.length > 0
  ) {
    list = list.filter((l) => props.selectedVolumeIds.includes(l.volume_id));
  }
  return list;
});

function formatLessonOption(les: LessonData): string {
  const vol = props.volumesList.find((v) => v.id === les.volume_id);
  const volPrefix = vol ? `${vol.title} · ` : "";
  return `${volPrefix}${les.title} (${les.entry_count ?? 0} Vokabeln)`;
}

// Active filters count
const activeFilterCount = computed(() => {
  let count = 0;
  if (searchQuery.value.trim()) count++;
  if (filterVolumeId.value) count++;
  if (filterLessonId.value) count++;
  if (filterBox.value !== null) count++;
  if (filterDueOnly.value) count++;
  if (filterPos.value) count++;
  return count;
});

function resetFilters() {
  searchQuery.value = "";
  filterVolumeId.value = "";
  filterLessonId.value = "";
  filterBox.value = null;
  filterDueOnly.value = false;
  filterPos.value = "";
  sortOrder.value = "curriculum";
}

// Load all entries for the active corpus
async function loadEntries() {
  loading.value = true;
  try {
    allEntries.value = await storage.getStudyQueue({
      corpus_id: props.corpusId,
      due_only: false,
      shuffle: false,
    });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.corpusId,
  () => {
    selectedEntry.value = null;
    loadEntries();
  },
);

onMounted(() => {
  loadEntries();
});

// Helper for due checking
const nowIso = new Date().toISOString();
function isDue(item: StudyCardItem): boolean {
  return item.next_due <= nowIso;
}

// Filtered & Sorted Entries
const filteredEntries = computed(() => {
  let list = allEntries.value;

  // 1. Scope Mode
  if (scopeMode.value === "selected") {
    if (props.selectedVolumeIds.length > 0) {
      list = list.filter((e) => props.selectedVolumeIds.includes(e.volume_id));
    }
    if (props.selectedLessonIds.length > 0) {
      list = list.filter(
        (e) => e.lesson_id && props.selectedLessonIds.includes(e.lesson_id),
      );
    }
  }

  // 2. Specific Volume Dropdown
  if (filterVolumeId.value) {
    list = list.filter((e) => e.volume_id === filterVolumeId.value);
  }

  // 3. Specific Lesson Dropdown
  if (filterLessonId.value) {
    list = list.filter((e) => e.lesson_id === filterLessonId.value);
  }

  // 4. Box Filter
  if (filterBox.value !== null) {
    list = list.filter((e) => e.box_number === filterBox.value);
  }

  // 5. Due Only
  if (filterDueOnly.value) {
    list = list.filter((e) => e.next_due <= nowIso);
  }

  // 6. POS Filter
  if (filterPos.value) {
    list = list.filter((e) => {
      const p = (e.pos || "").toLowerCase();
      if (filterPos.value === "noun") {
        return (
          p.includes("noun") ||
          p.includes("subst") ||
          p === "n" ||
          (Boolean(e.gender) && !e.lemma_native.endsWith("ना"))
        );
      }
      if (filterPos.value === "verb") {
        return (
          p.includes("verb") ||
          p === "v" ||
          (e.lemma_native.endsWith("ना") && !e.gender)
        );
      }
      if (filterPos.value === "adj") {
        return p.includes("adj");
      }
      if (filterPos.value === "other") {
        return (
          !p.includes("noun") &&
          !p.includes("subst") &&
          !p.includes("verb") &&
          !p.includes("adj")
        );
      }
      return true;
    });
  }

  // 7. Full-text Search Query (with automatic IAST/HK <-> Devanagari matching)
  if (searchQuery.value.trim()) {
    const qRaw = searchQuery.value.trim();
    const q = qRaw.toLowerCase();
    const qDeva = hkToDevanagariSync(qRaw);
    const qIast = hkToIast(qRaw).toLowerCase();

    list = list.filter((e) => {
      if (
        e.lemma_native.toLowerCase().includes(q) ||
        (qDeva && e.lemma_native.includes(qDeva))
      ) {
        return true;
      }
      if (
        e.lemma_translit.toLowerCase().includes(q) ||
        (qIast && e.lemma_translit.toLowerCase().includes(qIast))
      ) {
        return true;
      }
      if (e.definitions.some((d) => d.meaning.toLowerCase().includes(q))) {
        return true;
      }
      if (
        e.definitions.some((d) => (d.notes || "").toLowerCase().includes(q))
      ) {
        return true;
      }
      if (e.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      if (e.pos?.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  // 8. Sorting
  const sorted = [...list];
  switch (sortOrder.value) {
    case "deva-asc":
      sorted.sort((a, b) => a.lemma_native.localeCompare(b.lemma_native));
      break;
    case "translit-asc":
      sorted.sort((a, b) => a.lemma_translit.localeCompare(b.lemma_translit));
      break;
    case "meaning-asc": {
      sorted.sort((a, b) => {
        const mA = (a.definitions[0]?.meaning || "").toLowerCase();
        const mB = (b.definitions[0]?.meaning || "").toLowerCase();
        return mA.localeCompare(mB);
      });
      break;
    }
    case "box-asc":
      sorted.sort((a, b) => a.box_number - b.box_number);
      break;
    case "box-desc":
      sorted.sort((a, b) => b.box_number - a.box_number);
      break;
    default:
      // Keep natural order from corpus
      break;
  }

  return sorted;
});

// Format helpers
function formatPosShort(pos?: string | null): string {
  if (!pos) return "";
  const p = pos.toLowerCase();
  if (p.includes("noun") || p.includes("subst")) return "Subst.";
  if (p.includes("verb")) return "Verb";
  if (p.includes("adj")) return "Adj.";
  if (p.includes("adv")) return "Adv.";
  if (p.includes("pron")) return "Pron.";
  if (p.includes("postp")) return "Postp.";
  return pos;
}

function formatPosFull(pos?: string | null): string {
  if (!pos) return "";
  const p = pos.toLowerCase();
  if (p.includes("noun") || p.includes("subst")) return "Substantiv";
  if (p.includes("verb")) return "Verb";
  if (p.includes("adj")) return "Adjektiv";
  if (p.includes("adv")) return "Adverb";
  if (p.includes("pron")) return "Pronomen";
  if (p.includes("postp")) return "Postposition";
  return pos;
}

function formatGenderFull(gender?: string | null): string {
  if (!gender || gender === "-") return "";
  const g = gender.toLowerCase();
  if (g === "m") return "Maskulinum (m.)";
  if (g === "f") return "Femininum (f.)";
  if (g === "n") return "Neutrum (n.)";
  if (g === "m/f") return "Maskulin / Feminin";
  return gender;
}

function formatMeanings(item: StudyCardItem): string {
  return item.definitions.map((d) => d.meaning).join("; ");
}

function formatLessonLabel(item: StudyCardItem): string {
  const vol = props.volumesList.find((v) => v.id === item.volume_id);
  const vTitle = vol
    ? vol.title.replace(/Hindi bolo\s*/i, "Hb ")
    : item.volume_id;
  const les = props.lessonsList.find((l) => l.id === item.lesson_id);
  const lTitle = les
    ? les.title.replace(/Lektion\s*/i, "L")
    : item.lesson_id || "";
  return `${vTitle} · ${lTitle}`;
}

function getLessonTitle(lessonId?: string): string {
  if (!lessonId) return "";
  const les = props.lessonsList.find((l) => l.id === lessonId);
  return les ? les.title : lessonId;
}

// Inspect & Paradigms
function toggleEntryDetail(item: StudyCardItem) {
  if (selectedEntry.value?.entry_id === item.entry_id) {
    selectedEntry.value = null;
  } else {
    selectedEntry.value = item;
  }
}

const nounDeclension = computed<HindiNounDeclension | null>(() => {
  if (!props.isHindi || !selectedEntry.value) return null;
  const p = (selectedEntry.value.pos || "").toLowerCase();
  const isN =
    p.includes("noun") ||
    p.includes("subst") ||
    p === "n" ||
    (Boolean(selectedEntry.value.gender) &&
      !selectedEntry.value.lemma_native.endsWith("ना"));
  if (!isN) return null;
  return getHindiNounDeclension(
    selectedEntry.value.lemma_native,
    selectedEntry.value.lemma_translit,
    selectedEntry.value.gender,
  );
});

const verbParadigm = computed<HindiVerbParadigm | null>(() => {
  if (!props.isHindi || !selectedEntry.value) return null;
  const p = (selectedEntry.value.pos || "").toLowerCase();
  const isV =
    p.includes("verb") ||
    p === "v" ||
    (selectedEntry.value.lemma_native.endsWith("ना") &&
      !selectedEntry.value.gender);
  if (!isV) return null;
  return getHindiVerbParadigm(
    selectedEntry.value.lemma_native,
    selectedEntry.value.lemma_translit,
  );
});

// Practice actions
function speakItem(item: StudyCardItem) {
  const lang = props.corpusId.includes("hindi") ? "hi" : "sa";
  speechService.speak(item.lemma_native, lang);
}

function practiceFilteredSelection() {
  if (filteredEntries.value.length === 0) return;
  emit("practice-selection", filteredEntries.value);
}

function practiceSingleEntry(item: StudyCardItem) {
  selectedEntry.value = null;
  emit("practice-selection", [item]);
}

// Transliteration Search Toggle
async function toggleSearchTransliteration() {
  if (!searchQuery.value.trim()) return;
  searchQuery.value = await toggleTransliteration(
    searchQuery.value.trim(),
    "iast",
  );
}

// Download Filtered as TSV
function downloadFilteredTSV() {
  if (filteredEntries.value.length === 0) return;
  const header =
    "volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags";
  const rows = filteredEntries.value.map((e) => {
    return [
      e.volume_id,
      e.lesson_id ? e.lesson_id.replace(/^.*_l0?/, "") : "1",
      e.lemma_native,
      e.lemma_translit,
      e.pos || "",
      e.gender || "-",
      formatMeanings(e),
      (e.tags || []).join(";"),
    ].join("\t");
  });
  const tsvText = [header, ...rows].join("\n");
  const filename = `${props.corpusId}_export_${filteredEntries.value.length}_vokabeln.tsv`;
  downloadTSV(tsvText, filename);
}

// Copy as TSV
async function copyAsTSV() {
  const header = "Devanagari\tIAST\tWortart\tGenus\tBedeutung\tGliederung\tBox";
  const rows = filteredEntries.value.map((e) => {
    return [
      e.lemma_native,
      e.lemma_translit,
      e.pos || "",
      e.gender || "",
      formatMeanings(e),
      formatLessonLabel(e),
      `Box ${e.box_number}`,
    ].join("\t");
  });
  const tsvText = [header, ...rows].join("\n");
  try {
    await navigator.clipboard.writeText(tsvText);
    copyStatus.value = true;
    setTimeout(() => {
      copyStatus.value = false;
    }, 2500);
  } catch (err) {
    console.warn("Clipboard write failed:", err);
  }
}
</script>

<style scoped>
.vocabulary-explorer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem 1rem;
}

/* Header */
.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.header-titles h2 {
  font-size: 1.75rem;
  margin-bottom: 0.35rem;
  color: var(--text-primary);
}

.header-desc {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.btn-practice-selection {
  background: var(--accent-gold);
  color: #ffffff;
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(180, 83, 9, 0.25);
}

.btn-practice-selection:hover:not(:disabled) {
  background: var(--accent-gold-hover);
  transform: translateY(-1px);
}

.btn-practice-selection:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-copy-tsv {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  padding: 0.65rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-copy-tsv:hover:not(:disabled) {
  background: var(--bg-surface-elevated);
  border-color: var(--accent-gold);
}

/* Filter Toolbar */
.filter-toolbar {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: var(--card-shadow);
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0.5rem 0.85rem;
  gap: 0.65rem;
  transition: border-color 0.2s;
}

.search-box:focus-within {
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 2px rgba(180, 83, 9, 0.15);
}

.search-icon {
  font-size: 1.1rem;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
}

.clear-search-btn {
  color: var(--text-muted);
  font-size: 1rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.clear-search-btn:hover {
  color: var(--text-primary);
}

.translit-convert-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--accent-gold);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.translit-convert-btn:hover {
  background: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 90px;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pill-btn {
  background: var(--bg-surface-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.pill-btn:hover {
  border-color: var(--accent-gold);
  color: var(--text-primary);
}

.pill-btn.active {
  background: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
  font-weight: 600;
}

.box-pill-1.active { background: #ef4444; border-color: #ef4444; }
.box-pill-2.active { background: #f59e0b; border-color: #f59e0b; }
.box-pill-3.active { background: #3b82f6; border-color: #3b82f6; }
.box-pill-4.active { background: #6366f1; border-color: #6366f1; }
.box-pill-5.active { background: #10b981; border-color: #10b981; }
.box-pill-due.active { background: #dc2626; border-color: #dc2626; }

.filter-select {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
}

.filter-select:focus {
  border-color: var(--accent-gold);
}

/* Results Meta Bar */
.results-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  padding: 0 0.25rem;
}

.active-filter-badge {
  color: var(--accent-gold);
  font-weight: 600;
  margin-left: 0.35rem;
}

.btn-text-link {
  color: var(--accent-gold);
  font-size: 0.85rem;
  text-decoration: underline;
}

/* Table Card */
.table-card {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--card-shadow);
}

.table-responsive {
  overflow-x: auto;
}

.scholarly-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.92rem;
}

.scholarly-table th {
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: 0.85rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.scholarly-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.table-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table-row:hover {
  background-color: var(--bg-surface);
}

.table-row.row-active {
  background-color: rgba(180, 83, 9, 0.08);
}

.col-num {
  width: 40px;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
}

.col-native {
  white-space: nowrap;
}

.native-lemma-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-table-speak {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  font-size: 0.75rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.btn-table-speak:hover {
  opacity: 1;
  background: var(--accent-gold);
  border-color: var(--accent-gold);
  transform: scale(1.1);
}

.lemma-highlight {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
}

.col-translit {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.05rem;
  color: var(--text-secondary);
}

.grammar-badges {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.pos-badge {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 500;
}

.gender-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;
}

.gender-m {
  background: var(--gender-m-bg);
  color: var(--gender-m-text);
  border: 1px solid var(--gender-m-border);
}

.gender-f {
  background: var(--gender-f-bg);
  color: var(--gender-f-text);
  border: 1px solid var(--gender-f-border);
}

.gender-n {
  background: var(--gender-n-bg);
  color: var(--gender-n-text);
  border: 1px solid var(--gender-n-border);
}

.meaning-text {
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.item-tags {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.tag-pill {
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

.origin-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.col-box {
  white-space: nowrap;
}

.box-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  display: inline-block;
}

.box-1 { background: #fee2e2; color: #b91c1c; }
.box-2 { background: #fef3c7; color: #b45309; }
.box-3 { background: #dbeafe; color: #1d4ed8; }
.box-4 { background: #e0e7ff; color: #4338ca; }
.box-5 { background: #d1fae5; color: #047857; }

.due-dot {
  color: #dc2626;
  font-size: 0.8rem;
  margin-left: 0.35rem;
}

.btn-inspect {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  transition: all 0.15s;
}

.btn-inspect:hover {
  background: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
}

/* Empty State */
.empty-state {
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  display: block;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-subtle);
  border-top-color: var(--accent-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-outline-sm {
  margin-top: 1rem;
  padding: 0.4rem 1rem;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: 6px;
  font-size: 0.85rem;
}

/* Modal / Drawer */
.detail-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 25, 46, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.detail-modal-card {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.modal-lemma-block {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-modal-speak {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface-elevated);
  font-size: 1.1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-modal-speak:hover {
  background: var(--accent-gold);
  border-color: var(--accent-gold);
  transform: scale(1.08);
}

.modal-native {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-translit {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.3rem;
  color: var(--accent-gold);
}

.modal-close-btn {
  font-size: 1.25rem;
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-btn:hover {
  background: var(--border-subtle);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.modal-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.pos-badge-lg,
.lesson-badge-lg,
.box-badge-lg {
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}

.gender-badge-lg {
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.modal-meanings h4 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
}

.meanings-list {
  list-style: none;
  padding-left: 0;
}

.meanings-list li {
  font-size: 1.15rem;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}

.def-notes {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-left: 0.4rem;
}

.modal-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.tag-pill-lg {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.8rem;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.morphology-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
}

.morphology-section h4 {
  font-size: 1.05rem;
  margin-bottom: 0.85rem;
}

.paradigm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.paradigm-table th,
.paradigm-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.paradigm-table th {
  background: var(--bg-surface-elevated);
  font-weight: 600;
  text-align: left;
}

.translit-inline {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
}

.paradigm-rule-note {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-top: 0.75rem;
  font-style: italic;
}

.verb-stems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.stem-card {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stem-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.stem-val {
  font-size: 1.15rem;
  font-weight: 600;
}

.ergative-notice {
  margin-top: 0.85rem;
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid var(--accent-gold);
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  color: var(--text-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
}

.btn-primary {
  background: var(--accent-gold);
  color: #ffffff;
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
}

.btn-primary:hover {
  background: var(--accent-gold-hover);
}

.btn-outline {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.95rem;
}

.btn-outline:hover {
  background: var(--bg-surface);
}

@media (max-width: 768px) {
  .explorer-header {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    flex-direction: column;
  }
  .btn-practice-selection,
  .btn-copy-tsv {
    width: 100%;
    text-align: center;
  }
  .col-translit,
  .col-origin,
  .col-num {
    display: none;
  }
}
</style>
