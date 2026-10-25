<template>
  <div class="alexis-shell">
    <header class="alexis-header">
      <div class="brand">
        <span class="brand-crest">🏛️</span>
        <div class="brand-titles">
          <h1>ALEXIS</h1>
          <p class="subtitle">Scholarly Philological Vocabulary Trainer</p>
        </div>
      </div>
      <div class="corpus-badge">
        <span>Corpus:</span>
        <strong>Payer Sanskrit (Lektion 2)</strong>
      </div>
    </header>

    <main class="study-container">
      <div class="card-wrapper" :class="{ flipped: isFlipped }">
        <div class="study-card">
          <div class="card-meta">
            <span class="meta-tag">{{ currentCard.pos }}</span>
            <span class="meta-tag">{{ currentCard.gender ? currentCard.gender + '.' : 'ind.' }}</span>
            <span class="lesson-tag">Lektion {{ currentCard.lesson }}</span>
          </div>

          <div class="card-prompt">
            <div class="native-script">{{ currentCard.lemma.native }}</div>
            <div class="transliteration">{{ currentCard.lemma.transliteration }}</div>
          </div>

          <div v-if="isFlipped" class="card-answer">
            <div class="divider"></div>
            <div class="definition">{{ currentCard.definitions[0]?.meaning }}</div>
            
            <div v-if="currentCard.grammarMetadata?.root" class="root-hint">
              Wurzel: <strong>{{ currentCard.grammarMetadata.root }}</strong>
            </div>

            <div class="dict-actions">
              <a
                :href="mwLookupUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="mw-button"
              >
                📖 Monier-Williams Wörterbuch öffnen ↗
              </a>
            </div>
          </div>

          <div class="card-footer">
            <button
              v-if="!isFlipped"
              class="reveal-btn"
              @click="isFlipped = true"
            >
              Antwort aufdecken (Leertaste)
            </button>
            <div v-else class="rating-bar">
              <button class="rate-btn rate-again" @click="nextCard">1. Nochmals</button>
              <button class="rate-btn rate-hard" @click="nextCard">2. Schwer</button>
              <button class="rate-btn rate-good" @click="nextCard">3. Gut</button>
              <button class="rate-btn rate-easy" @click="nextCard">4. Leicht</button>
            </div>
          </div>
        </div>
      </div>

      <div class="study-stats">
        <span>Karte <strong>{{ currentIndex + 1 }}</strong> von <strong>{{ cards.length }}</strong></span>
        <span>Modus: <strong>Spaced Repetition (SRS)</strong></span>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { LexicalEntry } from './types';

const isFlipped = ref(false);
const currentIndex = ref(0);

const cards = ref<LexicalEntry[]>([
  {
    id: 'payer_sa_l02_deva',
    corpusId: 'payer_sanskrit',
    lesson: 2,
    lemma: {
      native: 'देव',
      transliteration: 'deva',
      script: 'Deva',
    },
    pos: 'm.',
    gender: 'm',
    grammarMetadata: {
      root: '√दिव्',
      stem: 'a-Stamm',
    },
    definitions: [
      {
        lang: 'de',
        meaning: 'Himmlischer, Gott; Fürst, König.',
      },
      {
        lang: 'en',
        meaning: 'Heavenly one, god, deity; prince, king.',
      },
    ],
  },
  {
    id: 'payer_sa_l02_isvara',
    corpusId: 'payer_sanskrit',
    lesson: 2,
    lemma: {
      native: 'ईश्वर',
      transliteration: 'īśvara',
      script: 'Deva',
    },
    pos: 'm.',
    gender: 'm',
    grammarMetadata: {
      root: '√ईश्',
      stem: 'a-Stamm',
    },
    definitions: [
      {
        lang: 'de',
        meaning: 'Herr, Herrscher, Gott (monotheistisch).',
      },
    ],
  },
  {
    id: 'payer_sa_l02_brahmana',
    corpusId: 'payer_sanskrit',
    lesson: 2,
    lemma: {
      native: 'ब्राह्मण',
      transliteration: 'brāhmaṇa',
      script: 'Deva',
    },
    pos: 'm.',
    gender: 'm',
    definitions: [
      {
        lang: 'de',
        meaning: 'Brahmane (geistlicher Stand, Priester).',
      },
    ],
  },
]);

const currentCard = computed(() => cards.value[currentIndex.value]);

const mwLookupUrl = computed(() => {
  const lemma = currentCard.value.lemma.transliteration;
  return `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/servepdf.php?dict=mw&key=${encodeURIComponent(lemma)}`;
});

function nextCard() {
  isFlipped.value = false;
  currentIndex.value = (currentIndex.value + 1) % cards.value.length;
}
</script>

<style>
:root {
  --bg-base: #fcf9f2;
  --bg-surface: #f1eee7;
  --text-primary: #03192e;
  --text-muted: #6b6257;
  --border-line: #d8d2c6;
  --accent: #b45309;
  --font-serif: 'Newsreader', Iowan Old Style, Palatino, Georgia, serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.alexis-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.alexis-header {
  padding: 1.25rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-line);
  background: rgba(252, 249, 242, 0.9);
  backdrop-filter: blur(12px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-crest {
  font-size: 1.8rem;
}

.brand-titles h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-primary);
}

.brand-titles .subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.corpus-badge {
  background: var(--bg-surface);
  border: 1px solid var(--border-line);
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  display: flex;
  gap: 0.35rem;
}

.study-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.card-wrapper {
  width: 100%;
  max-width: 540px;
}

.study-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-line);
  border-radius: 12px;
  padding: 2.5rem 2rem;
  box-shadow: 0 4px 16px rgba(3, 25, 46, 0.04);
  text-align: center;
}

.card-meta {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.meta-tag, .lesson-tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: #e6e2d8;
  color: var(--text-muted);
  font-weight: 500;
}

.lesson-tag {
  background: #fde8d0;
  color: var(--accent);
}

.card-prompt {
  margin: 1.5rem 0;
}

.native-script {
  font-family: 'Noto Serif Devanagari', 'Gentium Plus', serif;
  font-size: 3.2rem;
  line-height: 1.2;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.transliteration {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-style: italic;
  color: var(--accent);
}

.divider {
  height: 1px;
  background: var(--border-line);
  margin: 1.5rem 0;
}

.card-answer .definition {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  line-height: 1.4;
  margin-bottom: 1rem;
}

.root-hint {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.dict-actions {
  margin-top: 1rem;
}

.mw-button {
  display: inline-block;
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
  border: 1px solid #e0c8b0;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  background: #fffdf9;
  transition: all 0.15s ease;
}

.mw-button:hover {
  background: #faede0;
}

.card-footer {
  margin-top: 2rem;
}

.reveal-btn {
  background: var(--text-primary);
  color: #fff;
  border: none;
  padding: 0.75rem 1.75rem;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 500;
  transition: opacity 0.2s;
}

.reveal-btn:hover {
  opacity: 0.9;
}

.rating-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.rate-btn {
  border: 1px solid var(--border-line);
  background: #fff;
  padding: 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}

.rate-again { border-color: #fca5a5; color: #b91c1c; }
.rate-hard { border-color: #fed7aa; color: #c2410c; }
.rate-good { border-color: #bbf7d0; color: #15803d; }
.rate-easy { border-color: #bae6fd; color: #0369a1; }

.study-stats {
  margin-top: 1.5rem;
  display: flex;
  gap: 2rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
