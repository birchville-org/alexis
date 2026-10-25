<template>
  <div class="alexis-app" :data-theme="currentTheme">
    <!-- Header (Hidden in strict embed mode or minimal embed header) -->
    <header v-if="!isEmbedded" class="app-header">
      <div class="header-left">
        <img src="/birchville_logo.png" alt="Birchville" class="header-logo" />
        <div class="header-title-wrap">
          <h1 class="header-title">Alexis</h1>
          <span class="header-tagline">Philologischer Vokabeltrainer & Korpus-Hub</span>
        </div>
      </div>

      <nav class="header-nav">
        <button
          :class="['nav-btn', { active: currentTab === 'trainer' }]"
          @click="currentTab = 'trainer'"
        >
          Trainer
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'corpora' }]"
          @click="currentTab = 'corpora'"
        >
          Korpora & Gliederung
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'dictionary' }]"
          @click="currentTab = 'dictionary'"
        >
          Wörterbuch (MW)
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'stats' }]"
          @click="currentTab = 'stats'"
        >
          Statistik
        </button>
      </nav>

      <div class="header-right">
        <span v-if="isTauri" class="platform-badge">Rust / Desktop</span>
        <span v-else class="platform-badge">Payer Web / Offline</span>
        <button class="theme-toggle" @click="toggleTheme" :title="'Theme: ' + currentTheme">
          {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <!-- Compact Breadcrumb Bar in Embedded Mode -->
    <div v-else class="embedded-header">
      <div class="embed-title">
        <img src="/birchville_logo.png" alt="Birchville" class="embed-logo" />
        <strong>Alexis Trainer</strong>
        <span class="embed-sub">{{ activeCorpusTitle }} · {{ selectedVolumesSummary }}</span>
      </div>
      <div class="embed-actions">
        <button class="embed-switch-btn" @click="currentTab = currentTab === 'trainer' ? 'corpora' : 'trainer'">
          {{ currentTab === 'trainer' ? '⚙️ Filter / Gliederung' : '▶️ Zum Trainer' }}
        </button>
        <button class="theme-toggle" @click="toggleTheme">
          {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="app-main">
      <!-- 1. TRAINER TAB -->
      <section v-if="currentTab === 'trainer'" class="view-trainer">
        <div class="trainer-header">
          <div class="trainer-context">
            <span class="context-corpus">{{ activeCorpusTitle }}</span>
            <span class="context-sep">/</span>
            <span class="context-volumes">{{ selectedVolumesSummary }}</span>
          </div>
          <div class="trainer-counter" v-if="queue.length > 0">
            Karte {{ currentIndex + 1 }} von {{ queue.length }}
          </div>
        </div>

        <!-- Active Flashcard -->
        <div v-if="currentCard" class="card-container">
          <div class="study-card" :class="{ 'is-flipped': isFlipped }">
            <div class="card-top">
              <span class="box-badge">Box {{ currentCard.box_number }}</span>
              <span class="volume-badge">{{ currentCard.volume_title }}</span>
              <span v-if="currentCard.pos" class="pos-badge">{{ currentCard.pos }}</span>
              <span v-if="currentCard.gender" class="gender-badge">{{ currentCard.gender }}</span>
            </div>

            <!-- Front Side -->
            <div class="card-front">
              <div class="native-script script-deva">
                {{ currentCard.lemma_native }}
              </div>

              <div class="transliteration">
                <span v-if="showTranslit">{{ currentCard.lemma_translit }}</span>
                <button
                  class="toggle-translit-btn"
                  @click="showTranslit = !showTranslit"
                >
                  {{ showTranslit ? 'Umschrift verbergen' : 'Umschrift (IAST) anzeigen' }}
                </button>
              </div>

              <div v-if="!isFlipped" class="card-actions-reveal">
                <button class="btn-reveal" @click="isFlipped = true">
                  Bedeutung aufdecken (Leertaste)
                </button>
              </div>
            </div>

            <!-- Back Side (Revealed) -->
            <div v-if="isFlipped" class="card-back">
              <div class="definitions-list">
                <div
                  v-for="(def, idx) in currentCard.definitions"
                  :key="idx"
                  class="def-item"
                >
                  <div class="def-meaning">{{ def.meaning }}</div>
                  <div v-if="def.notes" class="def-notes">{{ def.notes }}</div>
                </div>
              </div>

              <div v-if="currentCard.tags && currentCard.tags.length" class="card-tags">
                <span v-for="tag in currentCard.tags" :key="tag" class="tag-pill">
                  #{{ tag }}
                </span>
              </div>

              <!-- Rating Buttons (Leitner 1..4) -->
              <div class="rating-bar">
                <button class="rate-btn btn-again" @click="submitRating(1)">
                  <span class="rate-num">1</span>
                  <span class="rate-label">Nochmal</span>
                  <span class="rate-sub">Box 1 (1 Tag)</span>
                </button>
                <button class="rate-btn btn-hard" @click="submitRating(2)">
                  <span class="rate-num">2</span>
                  <span class="rate-label">Schwer</span>
                  <span class="rate-sub">Gleiche Box</span>
                </button>
                <button class="rate-btn btn-good" @click="submitRating(3)">
                  <span class="rate-num">3</span>
                  <span class="rate-label">Gut</span>
                  <span class="rate-sub">+1 Box</span>
                </button>
                <button class="rate-btn btn-easy" @click="submitRating(4)">
                  <span class="rate-num">4</span>
                  <span class="rate-label">Einfach</span>
                  <span class="rate-sub">+1 Box (Bonus)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty / Finished Queue -->
        <div v-else class="empty-queue-card">
          <div class="empty-icon">✓</div>
          <h2>Alle Karten dieser Auswahl gelernt!</h2>
          <p>
            Für die ausgewählten Glieder (<strong>{{ selectedVolumesSummary }}</strong>) sind derzeit keine weiteren Karten fällig.
          </p>
          <div class="empty-actions">
            <button class="btn-primary" @click="reloadQueue(false)">
              Alle Karten erneut durchgehen (Lernmodus)
            </button>
            <button class="btn-outline" @click="currentTab = 'corpora'">
              Andere Glieder / Lektionen wählen
            </button>
          </div>
        </div>
      </section>

      <!-- 2. CORPORA & GLIEDERUNG TAB -->
      <section v-if="currentTab === 'corpora'" class="view-corpora">
        <div class="view-header">
          <h2>Korpora & Gliederungen</h2>
          <p class="view-desc">
            Wähle ein Lehrwerk und bestimme, welche Glieder (z.B. Hindi bolo 1, 2 und 3) gemeinsam geübt werden sollen.
          </p>
        </div>

        <!-- Corpus Picker -->
        <div class="corpus-selector-grid">
          <div
            v-for="corp in corporaList"
            :key="corp.id"
            :class="['corpus-card', { selected: selectedCorpusId === corp.id }]"
            @click="selectCorpus(corp.id)"
          >
            <div class="corpus-card-header">
              <span class="corpus-lang">{{ corp.lang_code.toUpperCase() }}</span>
              <span class="corpus-script">{{ corp.script }}</span>
            </div>
            <h3 class="corpus-title">{{ corp.title }}</h3>
            <p class="corpus-desc">{{ corp.description }}</p>
          </div>
        </div>

        <!-- Volume Multi-Selection Box -->
        <div class="volume-selection-panel" v-if="volumesList.length > 0">
          <div class="panel-header">
            <h3>Gliederungen für "{{ activeCorpusTitle }}"</h3>
            <div class="panel-header-actions">
              <button class="btn-link" @click="selectAllVolumes">Alle auswählen</button>
              <button class="btn-link" @click="selectedVolumeIds = []">Auswahl leeren</button>
            </div>
          </div>

          <div class="volumes-grid">
            <label
              v-for="vol in volumesList"
              :key="vol.id"
              :class="['volume-checkbox-card', { checked: selectedVolumeIds.includes(vol.id) }]"
            >
              <input
                type="checkbox"
                :value="vol.id"
                v-model="selectedVolumeIds"
              />
              <div class="vol-info">
                <span class="vol-title">{{ vol.title }}</span>
                <span v-if="vol.level" class="vol-level">{{ vol.level }}</span>
              </div>
            </label>
          </div>

          <div class="filter-options">
            <label class="checkbox-inline">
              <input type="checkbox" v-model="dueOnly" />
              <span>Nur fällige Wiederholungen (Spaced Repetition)</span>
            </label>
          </div>

          <div class="start-session-bar">
            <button
              class="btn-primary start-btn"
              :disabled="selectedVolumeIds.length === 0"
              @click="startSessionWithSelectedVolumes"
            >
              Lernkarten für ausgewählte Glieder starten ({{ selectedVolumeIds.length }} gewählt)
            </button>
          </div>
        </div>
      </section>

      <!-- 3. DICTIONARY TAB -->
      <section v-if="currentTab === 'dictionary'" class="view-dictionary">
        <div class="view-header">
          <h2>Wörterbuch-Hub (Monier-Williams)</h2>
          <p class="view-desc">
            Sanskrit- und philologische Lexikonsuche via Cologne Sanskrit Lexicon REST API.
          </p>
        </div>

        <div class="dict-search-box">
          <input
            type="text"
            v-model="dictQuery"
            placeholder="Suchbegriff in IAST oder Devanāgarī (z.B. deva, agni, dharma)..."
            @keyup.enter="performDictSearch"
            class="dict-input"
          />
          <button class="btn-primary" @click="performDictSearch" :disabled="dictLoading">
            {{ dictLoading ? 'Sucht...' : 'Nachschlagen' }}
          </button>
        </div>

        <div v-if="dictResults.length" class="dict-results">
          <div v-for="(res, idx) in dictResults" :key="idx" class="dict-card">
            <div class="dict-head">
              <h3>{{ res.headword }}</h3>
              <span class="dict-source">{{ res.source }}</span>
            </div>
            <div class="dict-body">
              <p v-for="(def, dIdx) in res.definitions" :key="dIdx" class="dict-def">
                {{ def }}
              </p>
            </div>
            <div v-if="res.externalUrl" class="dict-foot">
              <a :href="res.externalUrl" target="_blank" rel="noopener noreferrer" class="dict-link">
                ↗ Im Cologne Digital Sanskrit Lexicon öffnen
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. STATS TAB -->
      <section v-if="currentTab === 'stats'" class="view-stats">
        <div class="view-header">
          <h2>Lernstand & Statistiken</h2>
          <p class="view-desc">
            Leitner-Boxen-Verteilung und fällige Wiederholungen für "{{ activeCorpusTitle }}".
          </p>
        </div>

        <div class="stats-cards-grid" v-if="deckStats">
          <div class="stat-card">
            <span class="stat-val">{{ deckStats.total_entries }}</span>
            <span class="stat-lbl">Gesamte Vokabeln</span>
          </div>
          <div class="stat-card highlight">
            <span class="stat-val">{{ deckStats.due_today }}</span>
            <span class="stat-lbl">Heute fällig</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ deckStats.box_1 }}</span>
            <span class="stat-lbl">Box 1 (Neu / Nochmal)</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ deckStats.box_2 + deckStats.box_3 }}</span>
            <span class="stat-lbl">Box 2–3 (In Bearbeitung)</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ deckStats.box_4 + deckStats.box_5 }}</span>
            <span class="stat-lbl">Box 4–5 (Gefestigt)</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MonierWilliamsProvider } from "./providers/monierWilliams";
import { isTauriEnvironment, storage } from "./services/storage";
import type {
  CorpusMeta,
  DeckStats,
  DictionaryResult,
  StudyCardItem,
  VolumeData,
} from "./types";

// Theme & Environment
const isTauri = ref(isTauriEnvironment());
const currentTheme = ref<"light" | "dark">("light");
const isEmbedded = ref(false);

// Navigation Tabs
type Tab = "trainer" | "corpora" | "dictionary" | "stats";
const currentTab = ref<Tab>("trainer");

// Corpora & Gliederung State
const corporaList = ref<CorpusMeta[]>([]);
const selectedCorpusId = ref<string>("hindi-bolo");
const volumesList = ref<VolumeData[]>([]);
const selectedVolumeIds = ref<string[]>(["hb1", "hb2"]);
const dueOnly = ref(false);

// Study Session Queue State
const queue = ref<StudyCardItem[]>([]);
const currentIndex = ref<number>(0);
const isFlipped = ref<boolean>(false);
const showTranslit = ref<boolean>(true);

// Dictionary State
const dictProvider = new MonierWilliamsProvider();
const dictQuery = ref("");
const dictLoading = ref(false);
const dictResults = ref<DictionaryResult[]>([]);

// Stats State
const deckStats = ref<DeckStats | null>(null);

// Computed Helpers
const activeCorpusTitle = computed(() => {
  const corp = corporaList.value.find((c) => c.id === selectedCorpusId.value);
  return corp ? corp.title : selectedCorpusId.value;
});

const selectedVolumesSummary = computed(() => {
  if (selectedVolumeIds.value.length === 0) return "Keine Gliederung";
  if (
    selectedVolumeIds.value.length === volumesList.value.length &&
    volumesList.value.length > 0
  ) {
    return `Alle Glieder (1–${volumesList.value.length})`;
  }
  const titles = volumesList.value
    .filter((v) => selectedVolumeIds.value.includes(v.id))
    .map((v) => v.title);
  return titles.join(" + ");
});

const currentCard = computed(() => {
  if (queue.value.length === 0 || currentIndex.value >= queue.value.length) {
    return null;
  }
  return queue.value[currentIndex.value];
});

// Theme Toggle
function toggleTheme() {
  currentTheme.value = currentTheme.value === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme.value);
}

// Lifecycle Init
onMounted(async () => {
  // Check embed parameter from URL
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") === "true" || window.self !== window.top) {
    isEmbedded.value = true;
  }

  // Load available corpora
  corporaList.value = await storage.listCorpora();
  if (corporaList.value.length > 0) {
    const initialCorpus = params.get("corpus") || corporaList.value[0].id;
    await selectCorpus(initialCorpus);
  }

  // Handle lesson/volume params
  const volParam = params.get("volume");
  if (volParam) {
    selectedVolumeIds.value = [volParam];
  }

  // Load queue
  await reloadQueue(false);
  await refreshStats();
});

// Selection Logic
async function selectCorpus(corpusId: string) {
  selectedCorpusId.value = corpusId;
  volumesList.value = await storage.listVolumes(corpusId);
  // Default: select first two volumes (e.g. Hindi bolo 1 und 2)
  if (volumesList.value.length > 0) {
    selectedVolumeIds.value = volumesList.value.slice(0, 2).map((v) => v.id);
  } else {
    selectedVolumeIds.value = [];
  }
}

function selectAllVolumes() {
  selectedVolumeIds.value = volumesList.value.map((v) => v.id);
}

async function startSessionWithSelectedVolumes() {
  await reloadQueue(dueOnly.value);
  currentTab.value = "trainer";
}

async function reloadQueue(onlyDue: boolean) {
  currentIndex.value = 0;
  isFlipped.value = false;
  queue.value = await storage.getStudyQueue({
    corpus_id: selectedCorpusId.value,
    volume_ids:
      selectedVolumeIds.value.length > 0 ? selectedVolumeIds.value : undefined,
    due_only: onlyDue,
    limit: 100,
  });
}

async function submitRating(rating: number) {
  if (!currentCard.value) return;

  await storage.recordReview({
    entry_id: currentCard.value.entry_id,
    rating,
    direction: "NATIVE_TO_MEANING",
  });

  isFlipped.value = false;
  currentIndex.value += 1;
  await refreshStats();
}

async function refreshStats() {
  deckStats.value = await storage.getDeckStats(selectedCorpusId.value);
}

// Dictionary Action
async function performDictSearch() {
  if (!dictQuery.value.trim()) return;
  dictLoading.value = true;
  try {
    dictResults.value = await dictProvider.lookup(dictQuery.value.trim());
  } finally {
    dictLoading.value = false;
  }
}
</script>

<style scoped>
.alexis-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-base);
  color: var(--text-primary);
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background-color: var(--header-bg);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-logo {
  height: 2.1rem;
  border-radius: 4px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.18));
}

.header-title {
  font-size: 1.25rem;
  margin: 0;
  line-height: 1.2;
}

.header-tagline {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.header-nav {
  display: flex;
  gap: 0.5rem;
}

.nav-btn {
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.88rem;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.nav-btn.active {
  background-color: var(--accent-gold);
  color: #ffffff;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.platform-badge {
  font-size: 0.7rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: var(--text-muted);
}

.theme-toggle {
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  font-size: 0.9rem;
}

/* Embedded Compact Header */
.embedded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.embed-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
}

.embed-logo {
  height: 1.5rem;
}

.embed-sub {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.embed-switch-btn {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
}

/* Main Content */
.app-main {
  flex: 1;
  max-width: 54rem;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

/* Trainer View */
.trainer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  font-size: 0.88rem;
}

.trainer-context {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 500;
}

.context-sep {
  color: var(--text-muted);
}

.context-volumes {
  color: var(--accent-gold);
}

.trainer-counter {
  color: var(--text-muted);
}

/* Card */
.study-card {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: var(--card-shadow);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  min-height: 22rem;
  justify-content: space-between;
}

.card-top {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  justify-content: flex-start;
  margin-bottom: 1rem;
}

.box-badge, .volume-badge, .pos-badge, .gender-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

.box-badge {
  background-color: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
}

.native-script {
  font-size: 3.2rem;
  margin: 1rem 0;
  color: var(--text-primary);
  line-height: 1.2;
}

.transliteration {
  font-size: 1.25rem;
  color: var(--accent-gold);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.toggle-translit-btn {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: underline;
}

.card-actions-reveal {
  margin-top: 1.5rem;
}

.btn-reveal {
  background-color: var(--text-primary);
  color: var(--bg-base);
  padding: 0.75rem 1.75rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  transition: opacity 0.15s ease;
}

.btn-reveal:hover {
  opacity: 0.9;
}

/* Back Side */
.card-back {
  width: 100%;
  border-top: 1px dashed var(--border-subtle);
  padding-top: 1.5rem;
  margin-top: 1rem;
}

.def-meaning {
  font-size: 1.4rem;
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}

.def-notes {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.card-tags {
  margin-top: 0.75rem;
  display: flex;
  justify-content: center;
  gap: 0.4rem;
}

.tag-pill {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Rating Bar */
.rating-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-top: 1.75rem;
  width: 100%;
}

.rate-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  transition: transform 0.1s ease;
}

.rate-btn:hover {
  transform: translateY(-2px);
}

.rate-num {
  font-size: 0.75rem;
  font-weight: bold;
  opacity: 0.7;
}

.rate-label {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0.2rem 0;
}

.rate-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.btn-again .rate-label { color: var(--btn-again); }
.btn-hard .rate-label { color: var(--btn-hard); }
.btn-good .rate-label { color: var(--btn-good); }
.btn-easy .rate-label { color: var(--btn-easy); }

/* Empty Queue */
.empty-queue-card {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--accent-gold);
  margin-bottom: 1rem;
}

.empty-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

/* Corpora View */
.view-desc {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 0.25rem;
  margin-bottom: 1.5rem;
}

.corpus-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.corpus-card {
  background-color: var(--bg-surface-elevated);
  border: 2px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.corpus-card.selected {
  border-color: var(--accent-gold);
}

.corpus-card-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.volume-selection-panel {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.volumes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.volume-checkbox-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
}

.volume-checkbox-card.checked {
  border-color: var(--accent-gold);
}

.vol-title {
  font-weight: 500;
  display: block;
}

.vol-level {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.start-session-bar {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

/* Dictionary */
.dict-search-box {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.dict-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-elevated);
  color: var(--text-primary);
  font-size: 1rem;
}

.dict-card {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.dict-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.dict-source {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dict-link {
  color: var(--accent-gold);
  font-size: 0.85rem;
  text-decoration: none;
}

/* Stats */
.stats-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.stat-card {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
  text-align: center;
}

.stat-card.highlight {
  border-color: var(--accent-gold);
}

.stat-val {
  display: block;
  font-size: 2.2rem;
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--text-primary);
}

.stat-lbl {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Common Buttons */
.btn-primary {
  background-color: var(--accent-gold);
  color: #ffffff;
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.btn-primary:hover {
  background-color: var(--accent-gold-hover);
}

.btn-outline {
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
}

.btn-link {
  color: var(--accent-gold);
  font-size: 0.85rem;
  text-decoration: underline;
}
</style>
