<template>
  <div class="alexis-app" :data-theme="currentTheme">
    <!-- Header (Hidden in strict embed mode or minimal embed header) -->
    <header v-if="!isEmbedded" class="app-header">
      <div class="header-left">
        <img src="/alexis_logo.png" alt="Alexis" class="header-logo" />
        <div class="header-title-wrap">
          <h1 class="header-title">Alexis</h1>
          <span class="header-tagline">Vokabeltrainer</span>
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
          :class="['nav-btn', { active: currentTab === 'explorer' }]"
          @click="currentTab = 'explorer'"
        >
          Vokabelliste
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'corpora' }]"
          @click="currentTab = 'corpora'"
        >
          Korpora & Gliederung
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'dictionary' }]"
          @click="openDictionaryTab"
        >
          Wörterbuch
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'stats' }]"
          @click="currentTab = 'stats'"
        >
          Statistik
        </button>
      </nav>

      <div class="header-right">
        <button class="header-btn" @click="showHelpModal = true" title="Hilfe & Boxen-Systematik">
          ❓ Hilfe
        </button>
        <button class="header-btn highlight-btn" @click="handleOfflineOrInstall" title="Offline-Nutzung & Download">
          {{ deferredInstallPrompt ? '📥 App installieren' : '💾 Offline / Download' }}
        </button>
        <button class="theme-toggle" @click="toggleTheme" :title="'Theme: ' + currentTheme">
          {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <!-- Compact Breadcrumb Bar in Embedded Mode -->
    <div v-else class="embedded-header">
      <div class="embed-title">
        <img src="/alexis_logo.png" alt="Alexis" class="embed-logo" />
        <strong>Alexis Trainer</strong>
        <span class="embed-sub">{{ activeCorpusTitle }} · {{ selectedVolumesSummary }}</span>
      </div>
      <div class="embed-actions">
        <button
          class="direction-toggle-btn"
          @click="toggleDirection"
          :title="'Lernrichtung umschalten (Taste R). Aktuell: ' + directionLabel"
        >
          <span class="direction-swap-icon">⇄</span>
          <span>{{ directionLabel }}</span>
        </button>
        <button
          :class="['shuffle-toggle-btn', { active: isShuffle }]"
          @click="toggleShuffle"
          :title="'Reihenfolge umschalten (Taste S). Aktuell: ' + (isShuffle ? 'Zufall' : 'Alphabetisch')"
        >
          <span>🔀 {{ isShuffle ? 'Zufall' : 'A–Z' }}</span>
        </button>
        <button class="header-btn" @click="showHelpModal = true" title="Hilfe">❓ Hilfe</button>
        <button class="embed-switch-btn" @click="currentTab = currentTab === 'trainer' ? 'corpora' : 'trainer'">
          {{ currentTab === 'trainer' ? '⚙️ Filter / Gliederung' : '▶️ Zum Trainer' }}
        </button>
        <button class="theme-toggle" @click="toggleTheme">
          {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>
    </div>

    <!-- Desktop Auto-Update Banner (Tauri) -->
    <div
      v-if="isTauri && desktopUpdateInfo?.available && !desktopUpdateDismissed"
      class="desktop-update-banner"
    >
      <div class="desktop-update-text">
        <strong>Neue Desktop-Version v{{ desktopUpdateInfo.version }} verfügbar</strong>
        <span v-if="desktopUpdateInstalling && desktopUpdateProgress !== null">
          · Download {{ desktopUpdateProgress }}%
        </span>
      </div>
      <div class="desktop-update-actions">
        <button
          class="btn-primary"
          @click="installDesktopUpdate"
          :disabled="desktopUpdateInstalling"
        >
          {{ desktopUpdateInstalling ? "Installiert..." : "Jetzt aktualisieren" }}
        </button>
        <a
          :href="GITHUB_RELEASES_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-outline"
        >
          Release Notes
        </a>
        <button
          class="btn-link"
          @click="desktopUpdateDismissed = true"
          :disabled="desktopUpdateInstalling"
        >
          Später
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
          <div class="trainer-controls">
            <button
              class="direction-toggle-btn"
              @click="toggleDirection"
              :title="'Lernrichtung umschalten (Taste R). Aktuell: ' + directionLabel"
            >
              <span class="direction-swap-icon">⇄</span>
              <span class="direction-badge">{{ directionLabel }}</span>
            </button>
            <button
              :class="['shuffle-toggle-btn', { active: isShuffle }]"
              @click="toggleShuffle"
              :title="'Reihenfolge umschalten (Taste S). Aktuell: ' + (isShuffle ? 'Zufällig' : 'Alphabetisch')"
            >
              <span class="shuffle-icon">🔀</span>
              <span class="shuffle-badge">{{ isShuffle ? 'Zufall' : 'Alphabetisch' }}</span>
            </button>
            <button
              class="explorer-jump-btn"
              @click="currentTab = 'explorer'"
              title="Vokabelliste dieser Auswahl öffnen"
            >
              <span class="explorer-jump-icon">📋</span>
              <span class="explorer-jump-badge">Liste</span>
            </button>
            <div class="trainer-counter" v-if="queue.length > 0">
              Karte {{ currentIndex + 1 }} von {{ queue.length }}
            </div>
          </div>
        </div>

        <!-- Active Flashcard -->
        <div v-if="currentCard" class="card-container">
          <div class="study-card" :class="{ 'is-flipped': isFlipped }">
            <div class="card-top">
              <span class="box-badge">Box {{ currentCard.box_number }}</span>
              <span class="volume-badge">{{ currentCard.volume_title }}</span>
              <span v-if="currentCard.pos" class="pos-badge">{{ formatPos(currentCard.pos) }}</span>
              <span
                v-if="(studyDirection === 'target-to-de' || isFlipped) && (currentCard.gender || currentCard.pos === 'noun')"
                :class="['gender-badge', `gender-${(currentCard.gender || 'unknown').replace('/', '-')}`]"
              >
                {{ formatGender(currentCard.gender) }}
              </span>
              <span
                v-else-if="studyDirection === 'de-to-target' && !isFlipped && (currentCard.gender || currentCard.pos === 'noun')"
                class="gender-badge gender-prompt"
                title="Geschlecht beim Aufdecken"
              >
                Geschlecht: ?
              </span>
              <span
                v-if="hindiVerbParadigm && (studyDirection === 'target-to-de' || isFlipped)"
                :class="['ne-badge-top', hindiVerbParadigm.neBadgeClass]"
                :title="hindiVerbParadigm.neExplanation"
              >
                {{ hindiVerbParadigm.neBadge }}
              </span>
            </div>

            <!-- Front Side -->
            <div class="card-front">
              <!-- Mode: Target -> DE -->
              <template v-if="studyDirection === 'target-to-de'">
                <div class="native-script-row">
                  <div class="native-script script-deva">
                    {{ currentCard.lemma_native }}
                  </div>
                  <button
                    class="btn-audio-speak"
                    @click.stop="speakCurrentCard"
                    title="Aussprache anhören (Taste V)"
                    aria-label="Aussprache anhören"
                  >
                    <svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  </button>
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
              </template>

              <!-- Mode: DE -> Target -->
              <template v-else>
                <div class="de-prompt">
                  <div class="de-prompt-meanings">
                    <div
                      v-for="(def, idx) in currentCard.definitions"
                      :key="idx"
                      class="de-prompt-item"
                    >
                      {{ def.meaning }}
                    </div>
                  </div>
                  <div
                    v-if="currentCard.definitions.some(d => d.notes)"
                    class="de-prompt-notes"
                  >
                    {{ currentCard.definitions.filter(d => d.notes).map(d => d.notes).join(' · ') }}
                  </div>
                </div>
              </template>

              <div v-if="!isFlipped" class="card-actions-reveal">
                <button class="btn-reveal" @click="isFlipped = true">
                  {{ studyDirection === 'target-to-de' ? 'Bedeutung aufdecken (Leertaste)' : `${targetLangLabel} aufdecken (Leertaste)` }}
                </button>
              </div>
            </div>

            <!-- Back Side (Revealed) -->
            <div v-if="isFlipped" class="card-back">
              <!-- Mode: Target -> DE -->
              <div v-if="studyDirection === 'target-to-de'" class="definitions-list">
                <div
                  v-for="(def, idx) in currentCard.definitions"
                  :key="idx"
                  class="def-item"
                >
                  <div class="def-meaning">
                    <span
                      v-if="currentCard.gender"
                      :class="['def-gender-pill', `gender-${currentCard.gender.replace('/', '-')}`]"
                      :title="formatGender(currentCard.gender)"
                    >
                      {{ formatGenderShort(currentCard.gender) }}
                    </span>
                    <span class="def-text">{{ def.meaning }}</span>
                  </div>
                  <div v-if="def.notes" class="def-notes">{{ def.notes }}</div>
                </div>
              </div>

              <!-- Mode: DE -> Target -->
              <div v-else class="target-reveal-wrap">
                <div class="native-script-row">
                  <div class="native-script script-deva">
                    {{ currentCard.lemma_native }}
                  </div>
                  <button
                    class="btn-audio-speak"
                    @click.stop="speakCurrentCard"
                    title="Aussprache anhören (Taste V)"
                    aria-label="Aussprache anhören"
                  >
                    <svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  </button>
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

                <div class="target-reveal-meta">
                  <span
                    v-if="currentCard.gender"
                    :class="['def-gender-pill', `gender-${currentCard.gender.replace('/', '-')}`]"
                    :title="formatGender(currentCard.gender)"
                  >
                    {{ formatGender(currentCard.gender) }}
                  </span>
                  <span class="target-reveal-de">
                    {{ currentCard.definitions.map(d => d.meaning).join(' · ') }}
                  </span>
                </div>
              </div>

              <!-- Hindi Grammar Details: Noun Declension Table & Verb Paradigm -->
              <div v-if="isHindi && (hindiNounDeclension || hindiVerbParadigm)" class="grammar-section">
                <!-- Noun Declension Table -->
                <div v-if="hindiNounDeclension" class="grammar-box">
                  <div class="grammar-header" @click="toggleGrammarDrawer">
                    <div class="grammar-title">
                      <span class="grammar-icon">📖</span>
                      <span class="grammar-name">{{ hindiNounDeclension.declensionType }}</span>
                    </div>
                    <button class="grammar-toggle-btn" type="button" :title="showGrammarDrawer ? 'Tabelle einklappen (G)' : 'Tabelle ausklappen (G)'">
                      {{ showGrammarDrawer ? '▲ Einklappen (G)' : '▼ Deklinationstabelle (G)' }}
                    </button>
                  </div>

                  <div v-if="showGrammarDrawer" class="grammar-content">
                    <table class="declension-table">
                      <thead>
                        <tr>
                          <th>Kasus</th>
                          <th>Singular</th>
                          <th>Plural</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in hindiNounDeclension.rows" :key="row.kasus">
                          <td class="cell-kasus">
                            <strong>{{ row.kasus }}</strong>
                            <span class="kasus-sub">{{ row.kasusHelp }}</span>
                          </td>
                          <td class="cell-form">
                            <span class="form-deva">{{ row.sgNative }}</span>
                            <span class="form-translit">{{ row.sgTranslit }}</span>
                          </td>
                          <td class="cell-form">
                            <span class="form-deva">{{ row.plNative }}</span>
                            <span class="form-translit">{{ row.plTranslit }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div class="grammar-rule-hint">
                      <strong>Deklinationsregel:</strong> {{ hindiNounDeclension.ruleExplanation }}<br>
                      <span class="hint-sub">💡 {{ hindiNounDeclension.postpositionNote }}</span>
                    </div>
                  </div>
                </div>

                <!-- Verb Paradigm & Ergative Rules -->
                <div v-if="hindiVerbParadigm" class="grammar-box">
                  <div class="grammar-header" @click="toggleGrammarDrawer">
                    <div class="grammar-title">
                      <span class="grammar-icon">⚡</span>
                      <span class="grammar-name">Verb-Paradigma & Ergativ-Regel</span>
                      <span :class="['ne-badge', hindiVerbParadigm.neBadgeClass]">
                        {{ hindiVerbParadigm.neBadge }}
                      </span>
                    </div>
                    <button class="grammar-toggle-btn" type="button" :title="showGrammarDrawer ? 'Paradigma einklappen (G)' : 'Paradigma ausklappen (G)'">
                      {{ showGrammarDrawer ? '▲ Einklappen (G)' : '▼ Formen anzeigen (G)' }}
                    </button>
                  </div>

                  <div v-if="showGrammarDrawer" class="grammar-content">
                    <div class="ne-explanation-box">
                      <strong>Ergativ-Syntax:</strong> {{ hindiVerbParadigm.neExplanation }}
                    </div>

                    <div class="verb-grid">
                      <div class="verb-cell">
                        <span class="verb-label">Verbstamm</span>
                        <span class="verb-deva">{{ hindiVerbParadigm.rootNative }}-</span>
                        <span class="verb-translit">{{ hindiVerbParadigm.rootTranslit }}-</span>
                      </div>
                      <div class="verb-cell">
                        <span class="verb-label">Perfektpartizip (m/f)</span>
                        <span class="verb-deva">{{ hindiVerbParadigm.perfNative }}</span>
                        <span class="verb-translit">{{ hindiVerbParadigm.perfTranslit }}</span>
                      </div>
                      <div class="verb-cell">
                        <span class="verb-label">Habitualis / Präsens</span>
                        <span class="verb-deva">{{ hindiVerbParadigm.habitNative }}</span>
                        <span class="verb-translit">{{ hindiVerbParadigm.habitTranslit }}</span>
                      </div>
                      <div class="verb-cell">
                        <span class="verb-label">Futur</span>
                        <span class="verb-deva">{{ hindiVerbParadigm.futNative }}</span>
                        <span class="verb-translit">{{ hindiVerbParadigm.futTranslit }}</span>
                      </div>
                      <div class="verb-cell verb-cell-wide">
                        <span class="verb-label">Imperativ (Höflichkeitsstufen: तू / तुम / आप)</span>
                        <span class="verb-deva">{{ hindiVerbParadigm.impNative }}</span>
                        <span class="verb-translit">{{ hindiVerbParadigm.impTranslit }}</span>
                      </div>
                    </div>
                  </div>
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
            <button class="btn-outline" @click="currentTab = 'explorer'">
              📋 Vokabelliste durchsehen
            </button>
            <button class="btn-outline" @click="currentTab = 'corpora'">
              Andere Glieder / Lektionen wählen
            </button>
          </div>
        </div>
      </section>

      <!-- 2. VOCABULARY EXPLORER TAB -->
      <VocabularyExplorer
        v-if="currentTab === 'explorer'"
        :corpus-id="selectedCorpusId"
        :corpus-title="activeCorpusTitle"
        :is-hindi="isHindi"
        :can-edit-corpora="canImportCorpora"
        :volumes-list="volumesList"
        :lessons-list="lessonsList"
        :selected-volume-ids="selectedVolumeIds"
        :selected-lesson-ids="selectedLessonIds"
        @practice-selection="startSessionWithItems"
        @switch-tab="currentTab = $event as Tab"
        @entries-updated="reloadQueue(dueOnly)"
      />

      <!-- 3. CORPORA & GLIEDERUNG TAB -->
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
              <span class="runtime-mode-pill">{{ runtimeModeInfo.badge }}</span>
              <a
                v-if="!canImportCorpora"
                :href="GITHUB_RELEASES_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-link"
                title="Für eigenen TSV-Import Desktop-App herunterladen"
              >
                ↗ Desktop-App für TSV-Import
              </a>
              <label v-if="canImportCorpora" class="btn-link upload-label">
                <input
                  type="file"
                  accept=".tsv,.txt,.csv"
                  @change="handleFileUpload"
                  style="display:none"
                />
                📥 TSV importieren
              </label>
              <button class="btn-link" @click="selectAllVolumes">Alle auswählen</button>
              <button class="btn-link" @click="selectedVolumeIds = []">Auswahl leeren</button>
            </div>
          </div>
          <div v-if="importNotice" class="import-notice-banner">
            ✓ {{ importNotice }}
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
                <span class="vol-meta">
                  <span v-if="vol.entry_count !== undefined" class="vol-count">{{ vol.entry_count }} Vokabeln</span>
                  <span v-if="vol.level" class="vol-level"> · {{ vol.level }}</span>
                </span>
              </div>
            </label>
          </div>

          <!-- Lessons Filter Subpanel -->
          <div class="lessons-subpanel" v-if="filteredLessons.length > 0">
            <div class="subpanel-header">
              <h4>Lektionen auswählen:</h4>
              <div class="panel-header-actions">
                <button
                  class="btn-link"
                  @click="selectedLessonIds = filteredLessons.map((l) => l.id)"
                >
                  Alle Lektionen
                </button>
                <button
                  class="btn-link"
                  @click="selectedLessonIds = []"
                >
                  Zurücksetzen
                </button>
                <button
                  class="btn-link highlight-action"
                  @click="exportSelectedLessonsTSV"
                  :disabled="selectedLessonIds.length === 0"
                  title="Exportiert die ausgewählten Lektionen als TSV-Datei"
                >
                  📥 Gewählte als TSV exportieren
                </button>
              </div>
            </div>

            <div class="lessons-grid">
              <div
                v-for="les in filteredLessons"
                :key="les.id"
                :class="['lesson-checkbox-card', { checked: selectedLessonIds.includes(les.id) }]"
              >
                <label class="les-checkbox-wrap">
                  <input
                    type="checkbox"
                    :value="les.id"
                    v-model="selectedLessonIds"
                  />
                  <div class="les-info">
                    <span class="les-title">
                      {{
                        selectedVolumeIds.length > 1
                          ? `${getVolumeTitle(les.volume_id)} · ${les.title}`
                          : les.title
                      }}
                    </span>
                    <span v-if="les.entry_count !== undefined" class="les-count"
                      >{{ les.entry_count }} Vokabeln</span
                    >
                  </div>
                </label>
                <button
                  class="btn-tsv-export"
                  @click.stop="exportSingleLessonTSV(les)"
                  title="Diese Lektion als TSV herunterladen"
                >
                  📥 TSV
                </button>
              </div>
            </div>
          </div>

          <div class="filter-options">
            <label class="checkbox-inline">
              <input type="checkbox" v-model="dueOnly" />
              <span>Nur fällige Wiederholungen (Spaced Repetition)</span>
            </label>
            <label class="checkbox-inline">
              <input type="checkbox" v-model="isShuffle" @change="toggleShuffle" />
              <span>Zufällige Reihenfolge (Shuffle / Random)</span>
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
            <button
              class="btn-outline explorer-quick-btn"
              :disabled="selectedVolumeIds.length === 0"
              @click="currentTab = 'explorer'"
            >
              📋 Vokabelliste dieser Auswahl öffnen
            </button>
          </div>
        </div>
      </section>

      <!-- 3. DICTIONARY TAB -->
      <section v-if="currentTab === 'dictionary'" class="view-dictionary">
        <div class="view-header">
          <h2>
            {{
              dictLang === "hi"
                ? "Wörterbuch-Hub (Hindi: Wiktionary & DSAL)"
                : "Wörterbuch-Hub (Sanskrit: MW, PW, DCS & NWS)"
            }}
          </h2>
          <p class="view-desc">
            {{
              dictLang === "hi"
                ? "Hindi-Lexikonsuche via Wiktionary REST API mit Direktlinks zu McGregor & Platts (DSAL Chicago)."
                : "Sanskrit-Lexikonsuche via Cologne Sanskrit Lexicon (MW & Petersburger Wörterbuch) mit Direktlinks zu DCS & NWS Halle."
            }}
          </p>
        </div>

        <div class="dict-provider-switch" role="tablist" aria-label="Wörterbuch-Auswahl">
          <button
            :class="['dict-provider-btn', { active: dictLang === 'sa' }]"
            @click="selectDictLang('sa')"
          >
            Sanskrit (MW / PW / DCS / NWS)
          </button>
          <button
            :class="['dict-provider-btn', { active: dictLang === 'hi' }]"
            @click="selectDictLang('hi')"
          >
            Hindi (Wiktionary / McGregor / Platts)
          </button>
        </div>

        <div class="dict-search-box">
          <input
            type="text"
            v-model="dictQuery"
            :placeholder="
              dictLang === 'hi'
                ? 'Suchbegriff in Devanāgarī, IAST oder HK (z.B. किताब, kitāb, namaste)...'
                : 'Suchbegriff in IAST oder Devanāgarī (z.B. deva, agni, dharma)...'
            "
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
              <h3>
                {{ res.headword }}
                <span v-if="res.transliteration" class="dict-translit">({{ res.transliteration }})</span>
              </h3>
              <span class="dict-source">{{ res.source }}</span>
            </div>
            <div class="dict-body">
              <p v-for="(def, dIdx) in res.definitions" :key="dIdx" class="dict-def">
                {{ def }}
              </p>
            </div>
            <div v-if="res.externalLinks?.length" class="dict-foot">
              <a
                v-for="(link, lIdx) in res.externalLinks"
                :key="lIdx"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="dict-link"
              >
                {{ link.label }}
              </a>
            </div>
            <div v-else-if="res.externalUrl" class="dict-foot">
              <a :href="res.externalUrl" target="_blank" rel="noopener noreferrer" class="dict-link">
                {{ res.externalLabel || "↗ Im Online-Wörterbuch öffnen" }}
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

    <!-- HILFE MODAL (Vollständiges Offline-Benutzerhandbuch mit VitePress-Layout) -->
    <div v-if="showHelpModal" class="modal-backdrop" @click.self="showHelpModal = false">
      <div class="modal-box help-modal-doc">
        <div class="doc-header">
          <div class="doc-header-title">
            <span class="doc-badge">DOCS</span>
            <h3>Benutzerhandbuch & Systematik</h3>
          </div>
          <button class="modal-close-btn" @click="showHelpModal = false" title="Schließen (Esc)">✕</button>
        </div>

        <div class="doc-layout">
          <!-- Linke VitePress-Seitenleiste -->
          <aside class="doc-sidebar" aria-label="Handbuch-Navigation">
            <div class="doc-sidebar-group">
              <span class="doc-group-title">Inhaltsverzeichnis</span>
              <ul class="doc-nav-list">
                <li
                  v-for="sec in helpSections"
                  :key="sec.id"
                  :class="['doc-nav-item', { active: activeHelpSection === sec.id }]"
                >
                  <button
                    class="doc-nav-btn"
                    type="button"
                    @click="selectHelpSection(sec.id)"
                  >
                    <span class="doc-nav-num">{{ sec.num }}</span>
                    <span class="doc-nav-label">{{ sec.title.replace(/^\d+\.\s*/, '') }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <div class="doc-sidebar-footer">
              <span class="doc-version-tag">Alexis v0.3.1 · Local-First</span>
            </div>
          </aside>

          <!-- Rechter Lesebereich -->
          <article class="doc-content" role="region" aria-label="Kapitelinhalt">
            <!-- Kapitel 1 -->
            <section v-show="activeHelpSection === 'sec-1'" class="doc-section">
              <div class="doc-crumb">Kapitel 1 · Architektur</div>
              <h4>1. Philosophie & Architektur: Datensouveränität (Local-First)</h4>
              <p class="modal-text">
                Alexis folgt dem Prinzip <strong>Zero-Config Local-First</strong> und trennt strikt zwischen dem schreibgeschützten Server und Ihrem privaten Gerätespeicher:
              </p>
              <div class="doc-callout">
                <strong>Zentrales Sicherheits- und Architekturversprechen:</strong>
                Kein Lernender benötigt einen Account, und keine persönlichen Lernstatistiken verlassen jemals Ihr Gerät.
              </div>
              <ul class="help-list">
                <li><strong>Drei Betriebsarten (Browser / PWA vs. Desktop-App):</strong> Im <em>Browser</em> und in der installierten <em>PWA</em> ist Alexis ein Read-Only-Offliner für den kuratierten Wortschatz (Lernstände liegen lokal in <code>IndexedDB</code>; regelmäßiges <code>.json</code>-Backup empfohlen). Wer eigene Wortlisten als <code>.tsv</code> importieren und dauerhaft in <code>SQLite</code> kuratieren möchte, nutzt die <a :href="GITHUB_RELEASES_URL" target="_blank" rel="noopener noreferrer" class="dict-link">Desktop-App (macOS, Windows, Linux)</a>.</li>
                <li><strong>Der Server als schreibgeschützte Basis (Read-Only):</strong> Die auf GitHub Pages bereitgestellte Web-App liefert den Programmcode und die kuratierten Kern-Wörterbücher (<em>Hindi bolo</em>, <em>Sanskritkurs Alois Payer</em>). Da GitHub Pages ein rein statischer Webserver ohne Schreib-API ist, kann kein externer Nutzer Dateien auf dem Server verändern oder überschreiben. Das Einlesen neuer Wörter ist online blockiert; offizielle Korpora werden ausschließlich über die lokale Redaktions-Pipeline validiert und vom Repository-Inhaber per <code>git push</code> eingespielt.</li>
                <li><strong>100 % lokale Datenhaltung:</strong> Lernstände, Box-Zuordnungen und Fälligkeitsdaten werden ausschließlich lokal im Browser (<code>IndexedDB</code> / <code>localStorage</code>) bzw. in der Desktop-App (<code>SQLite</code>) gespeichert. Es findet keinerlei Upload persönlicher Lerndaten auf einen Server statt.</li>
                <li><strong>Automatische App-Updates ohne Datenverlust:</strong> Bei Internetverbindung aktualisiert die PWA im Hintergrund automatisch den Programmcode und neue Lektionen der Basis-Korpora. Ihre lokalen Lernfortschritte bleiben davon unberührt erhalten.</li>
                <li><strong>Souveräner Export:</strong> Sie können einzelne Lektionen oder gefilterte Auswahlen jederzeit über <em>„📥 TSV exportieren“</em> als saubere Textdatei für eigene Notizen oder zur Weitergabe sichern.</li>
              </ul>
            </section>

            <!-- Kapitel 2 -->
            <section v-show="activeHelpSection === 'sec-2'" class="doc-section">
              <div class="doc-crumb">Kapitel 2 · Didaktik</div>
              <h4>2. Das 5-Fächer-Leitner-Prinzip & die 4 Bewertungstasten</h4>
              <p class="modal-text">
                Jede neue Vokabel startet in Box 1 und wandert bei Lernerfolg schrittweise in höhere Boxen mit festen, berechenbaren Zeitintervallen:
              </p>
              <table class="help-table">
                <thead>
                  <tr>
                    <th>Box</th>
                    <th>Status</th>
                    <th>Wiederholung</th>
                    <th>Funktion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Box 1</strong></td>
                    <td>Neu / Nochmal</td>
                    <td><strong>1 Tag</strong></td>
                    <td>Täglich üben, bis der Abruf sitzt.</td>
                  </tr>
                  <tr>
                    <td><strong>Box 2</strong></td>
                    <td>Erster Lernerfolg</td>
                    <td><strong>3 Tage</strong></td>
                    <td>Mindestens einmal richtig gewusst.</td>
                  </tr>
                  <tr>
                    <td><strong>Box 3</strong></td>
                    <td>Festigung</td>
                    <td><strong>7 Tage</strong></td>
                    <td>Übergang ins mittelfristige Gedächtnis.</td>
                  </tr>
                  <tr>
                    <td><strong>Box 4</strong></td>
                    <td>Vertiefung</td>
                    <td><strong>14 Tage</strong></td>
                    <td>Hohe Abrufsicherheit.</td>
                  </tr>
                  <tr>
                    <td><strong>Box 5</strong></td>
                    <td>Langzeitgedächtnis</td>
                    <td><strong>30 Tage</strong></td>
                    <td>Dauerhaft verankert.</td>
                  </tr>
                </tbody>
              </table>

              <ul class="help-list">
                <li><strong>Taste 1 (Nochmal):</strong> Die Karte fällt sofort auf <strong>Box 1</strong> zurück (Intervall: 1 Tag).</li>
                <li><strong>Taste 2 (Schwer):</strong> Die Karte bleibt in der aktuellen Box (Intervall: 1 Tag).</li>
                <li><strong>Taste 3 (Gut / 2x Leertaste):</strong> Die Karte steigt um <strong>+1 Box auf</strong> (z.B. Box 1 ➔ Box 2: 3 Tage).</li>
                <li><strong>Taste 4 (Einfach):</strong> Die Karte steigt um <strong>+1 Box auf mit Bonussprung</strong> (z.B. Box 1 ➔ Box 2: 5 Tage).</li>
              </ul>
            </section>

            <!-- Kapitel 3 -->
            <section v-show="activeHelpSection === 'sec-3'" class="doc-section">
              <div class="doc-crumb">Kapitel 3 · Audio & Phonetik</div>
              <h4>3. Technische Architektur der Sprachausgabe (W3C Web Speech API)</h4>
              <p class="modal-text">
                Für die Vertonung der Vokabeln über das Lautsprecher-Symbol oder die Taste <code>v</code> nutzt Alexis den <strong>W3C Web Speech API Standard</strong> (<code>window.speechSynthesis</code> / <code>SpeechSynthesisUtterance</code>):
              </p>
              <ul class="help-list">
                <li><strong>Kein externer Cloud-Dienst / kein API-Schlüssel:</strong> Es werden keine Wörter an kostenpflichtige Drittanbieter-Server gesendet. Alexis greift direkt auf die im Betriebssystem bzw. Browser lokal installierten Text-to-Speech-Stimmen (TTS) zu und funktioniert damit auch offline.</li>
                <li><strong>macOS & iOS (Safari, Tauri Desktop, Chrome):</strong> Nutzt Apples Systemstimme <strong>„Lekha“</strong> (<code>hi-IN</code>). Für maximale Klangqualität kann in den Systemeinstellungen unter <em>Bedienungshilfen ➔ Gesprochener Inhalt ➔ Systemstimme ➔ Stimme verwalten ➔ Hindi</em> das Paket <strong>„Lekha (Erweitert / Premium)“</strong> kostenfrei nachgeladen werden.</li>
                <li><strong>Windows, Chrome & Android:</strong> Nutzt unter Desktop-Chrome <code>Google हिन्दी</code> (<code>hi-IN</code>), unter Windows 10/11 <strong>„Microsoft Swara“</strong> bzw. <strong>„Microsoft Hemant“</strong> und unter Android die <strong>Google Speech Synthesis</strong>.</li>
                <li><strong>Phonetische Treue & Sanskrit-Fallback:</strong> Da Devanāgarī phonematisch exakt ist, werden Aspiration, Retroflexe und Vokallängen direkt aus der Originalschrift synthetisiert. Das Sprechtempo ist leicht gedrosselt (<code>rate = 0.88</code>). Fehlt eine dedizierte <code>sa-IN</code>-Stimme für Sanskrit, fällt Alexis automatisch auf die installierte <code>hi-IN</code>-Devanāgarī-Stimme zurück.</li>
              </ul>
            </section>

            <!-- Kapitel 4 -->
            <section v-show="activeHelpSection === 'sec-4'" class="doc-section">
              <div class="doc-crumb">Kapitel 4 · Arbeitsbereich</div>
              <h4>4. Vokabel-Explorer & Bidirektionale Umschrift (IAST / HK ⇄ Devanāgarī)</h4>
              <ul class="help-list">
                <li><strong>Vokabelliste:</strong> Im Reiter <em>Vokabelliste</em> lässt sich der gesamte Wortschatz nach Band, Lektion, Leitner-Box, Fälligkeit und Wortart filtern, inspizieren (inkl. Deklinations- und Verb-Paradigmen) und per Klick (<em>„▶️ Auswahl üben“</em>) direkt an den Trainer übergeben.</li>
                <li><strong>Automatische Transliterations-Suche:</strong> Das Suchfeld erkennt Eingaben in Devanāgarī, wissenschaftlicher IAST-Umschrift (<code>kṛṣṇa</code>) und ASCII-basierter Harvard-Kyoto-Notation (<code>kRSNa</code>) gleichzeitig. Über die Schaltfläche <code>अ ⇄ a</code> lässt sich der Suchbegriff direkt zwischen Lateinschrift und Devanāgarī umwandeln.</li>
              </ul>
            </section>

            <!-- Kapitel 5 -->
            <section v-show="activeHelpSection === 'sec-5'" class="doc-section">
              <div class="doc-crumb">Kapitel 5 · Steuerung</div>
              <h4>5. Pflicht-Geschlechter, Lernrichtung & Sortierung</h4>
              <p class="modal-text">
                • <strong>Pflicht-Geschlechter bei Substantiven:</strong> Jedes Substantiv ist mit dem grammatischen Geschlecht gekennzeichnet (<strong>m.</strong> = Maskulinum, <strong>f.</strong> = Femininum, <strong>n.</strong> = Neutrum, <strong>m./f.</strong> = zweigeschlechtlich).<br>
                • <strong>Umkehrbare Lernrichtung (⇄ / Taste <code>r</code>):</strong> Wechselt jederzeit on-the-fly zwischen <em>Zielsprache ➔ Deutsch</em> und <em>Deutsch ➔ Zielsprache</em>, ohne doppelte Kartensätze anzulegen.<br>
                • <strong>Sortierung (🔀 / Taste <code>s</code>):</strong> Schaltet zwischen Lehrbuch-Reihenfolge und Zufallsmischung (Shuffle) um.
              </p>
            </section>

            <!-- Kapitel 6 -->
            <section v-show="activeHelpSection === 'sec-6'" class="doc-section">
              <div class="doc-crumb">Kapitel 6 · Schnellbedienung</div>
              <h4>6. Tastaturkürzel-Referenz</h4>
              <table class="help-table">
                <thead>
                  <tr>
                    <th>Taste</th>
                    <th>Aktion im Trainer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>Leertaste</code> / <code>Enter</code></td>
                    <td>Karte aufdecken (nach Aufdecken: Schnellbewertung „Gut“ +1 Box)</td>
                  </tr>
                  <tr>
                    <td><code>1</code></td>
                    <td>Bewertung: <strong>Nochmal</strong> (Rückfall auf Box 1)</td>
                  </tr>
                  <tr>
                    <td><code>2</code></td>
                    <td>Bewertung: <strong>Schwer</strong> (In aktueller Box belassen)</td>
                  </tr>
                  <tr>
                    <td><code>3</code></td>
                    <td>Bewertung: <strong>Gut</strong> (+1 Box)</td>
                  </tr>
                  <tr>
                    <td><code>4</code></td>
                    <td>Bewertung: <strong>Einfach</strong> (+1 Box mit Bonussprung)</td>
                  </tr>
                  <tr>
                    <td><code>v</code></td>
                    <td><strong>Aussprache anhören</strong> (Web Speech TTS)</td>
                  </tr>
                  <tr>
                    <td><code>r</code></td>
                    <td><strong>Lernrichtung umkehren</strong> (Zielsprache ⇄ Deutsch)</td>
                  </tr>
                  <tr>
                    <td><code>s</code></td>
                    <td><strong>Zufall / Shuffle</strong> umschalten</td>
                  </tr>
                  <tr>
                    <td><code>g</code></td>
                    <td><strong>Grammatik-Drawer</strong> (Deklination/Verben) ein-/ausklappen</td>
                  </tr>
                  <tr>
                    <td><code>u</code> / <code>t</code></td>
                    <td><strong>Umschrift (IAST)</strong> ein-/ausblenden</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <!-- Kapitel 7 -->
            <section v-show="activeHelpSection === 'sec-7'" class="doc-section">
              <div class="doc-crumb">Kapitel 7 · Datenformate</div>
              <h4>7. Struktur der TSV-Dateien & Redaktions-Pipeline</h4>
              <p class="modal-text">
                Das Einlesen neuer Wörter ist in der Online-Web-App / PWA deaktiviert, um die Konsistenz der Referenz-Wörterbücher zu sichern. Neue Lektionen werden lokal durch den Redaktor validiert (Free Dictionary API, Lexicala-Cache, IAST-Schwa-Tilgungs-Check) und per Git eingespielt. Der Export pro Lektion oder Auswahl als <code>.tsv</code> steht jederzeit zur Verfügung:
              </p>
              <table class="help-table">
                <thead>
                  <tr>
                    <th>Spaltenname</th>
                    <th>Status</th>
                    <th>Beispiel</th>
                    <th>Bedeutung / Funktion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>volume</code></td>
                    <td>Optional</td>
                    <td><code>hb1</code></td>
                    <td>Band-Kennung (z.B. <code>hb1</code>, <code>hb2</code>). Legt bei neuen Werten automatisch einen neuen Band an. Default: <code>hb1</code>.</td>
                  </tr>
                  <tr>
                    <td><code>lesson</code></td>
                    <td>Optional</td>
                    <td><code>1</code></td>
                    <td>Lektionsnummer als Ganzzahl (z.B. <code>1</code>, <code>2</code>). Legt bei neuen Werten eine neue Lektion an. Default: <code>1</code>.</td>
                  </tr>
                  <tr>
                    <td><code>native</code></td>
                    <td><strong>Pflicht</strong></td>
                    <td><code>किताब</code></td>
                    <td>Wort in Nativschrift (Devanāgarī). Dient als Primärschlüssel zur automatischen Duplikaterkennung und Bedeutungsverschmelzung.</td>
                  </tr>
                  <tr>
                    <td><code>transliteration</code></td>
                    <td>Empfohlen</td>
                    <td><code>kitāb</code></td>
                    <td>Wissenschaftliche Umschrift (IAST).</td>
                  </tr>
                  <tr>
                    <td><code>pos</code></td>
                    <td>Empfohlen</td>
                    <td><code>noun</code></td>
                    <td>Wortart (z.B. <code>noun</code> für Substantiv, <code>verb</code>, <code>adj</code>, <code>adv</code>, <code>postp</code>, <code>pron</code>).</td>
                  </tr>
                  <tr>
                    <td><code>gender</code></td>
                    <td><strong>Pflicht für Nomen</strong></td>
                    <td><code>f</code></td>
                    <td>Grammatisches Geschlecht: <code>m</code> (Maskulinum), <code>f</code> (Femininum), <code>n</code> (Neutrum), <code>m/f</code> oder <code>-</code> (nicht anwendbar).</td>
                  </tr>
                  <tr>
                    <td><code>meaning_de</code></td>
                    <td><strong>Pflicht</strong></td>
                    <td><code>Buch</code></td>
                    <td>Deutsche Bedeutung bzw. Übersetzung. (Jede Spalte, deren Name <code>meaning</code> enthält, wird akzeptiert).</td>
                  </tr>
                  <tr>
                    <td><code>tags</code></td>
                    <td>Optional</td>
                    <td><code>schule;a1</code></td>
                    <td>Semikolon-getrennte Schlagwörter (<code>tag1;tag2</code>) für Filter und thematische Gruppen.</td>
                  </tr>
                </tbody>
              </table>
              <p class="modal-text">
                <strong>Musterzeile (Tab-getrennt):</strong><br>
                <code>hb1&#9;1&#9;किताब&#9;kitāb&#9;noun&#9;f&#9;Buch&#9;schule;a1</code>
              </p>
            </section>

            <!-- Kapitel 8 -->
            <section v-show="activeHelpSection === 'sec-8'" class="doc-section">
              <div class="doc-crumb">Kapitel 8 · Ausblick</div>
              <h4>8. Usability-Konzept & Roadmap (Vergleich mit Anki)</h4>
              <table class="help-table">
                <thead>
                  <tr>
                    <th>Aspekt</th>
                    <th>Klassisch (z.B. Anki)</th>
                    <th>Alexis-Prinzip</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Bedienung & Setup</strong></td>
                    <td>Desktop-Installation, Account-Zwang, Dutzende Schwellenwerte und Optionen (Ease, Steps, Leech).</td>
                    <td><strong>Zero-Config Local-First:</strong> Sofort im Browser nutzbar, 100% offline-fähig, keine Registrierung.</td>
                  </tr>
                  <tr>
                    <td><strong>Lektionswahl</strong></td>
                    <td>Starre Deck-Hierarchien; Filtern erfordert komplexe Suchsyntax.</td>
                    <td><strong>Direkte Multi-Selektion:</strong> Beliebige Bände und Lektionen per Klick auswählen.</td>
                  </tr>
                  <tr>
                    <td><strong>Lernrichtung</strong></td>
                    <td>Erfordert separate Notiztypen und doppelte Kartendaten.</td>
                    <td><strong>Dynamische Inversion:</strong> Taste <code>r</code> wechselt die Richtung on-the-fly.</td>
                  </tr>
                  <tr>
                    <td><strong>Philologie & Grammatik</strong></td>
                    <td>Reiner Freitext; Tabellen müssen manuell gebaut werden.</td>
                    <td><strong>Automatisierte Paradigmen:</strong> Nativ integrierte Deklinationstabellen, Verbstämme und Ergativ-Regeln.</td>
                  </tr>
                  <tr>
                    <td><strong>Lernlogik</strong></td>
                    <td>Komplexe Algorithmen mit Gefahr der „Ease Hell“ und Kartenbergen.</td>
                    <td><strong>5-Boxen-Leitner:</strong> Transparente Intervalle (1, 3, 7, 14, 30 Tage) – stressfrei und berechenbar.</td>
                  </tr>
                </tbody>
              </table>

              <p class="modal-text">
                <strong>Ausbaustufen (Roadmap):</strong>
                <br>• <strong>✓ Phase 1: Vokabel-Explorer & Listenansicht (Live):</strong> Gesamtschau aller Vokabeln im Reiter „Vokabelliste“ mit Sofortsuche, Leitner-Box-Filtern, Wortart-Filter, morphologischen Paradigmen und 1-Klick-Lernstart.
                <br>• <strong>✓ Phase 2: Native Sprachausgabe (TTS - Live):</strong> Audio-Aussprache über die Web Speech API per Taste <code>v</code> sowie Lautsprecher-Buttons auf Lernkarten und im Vokabel-Explorer.
                <br>• <strong>Phase 3: Session-Recap:</strong> Am Ende einer Sitzung die Fehlkarten mit 1 Klick nochmals festigen.
                <br>• <strong>Phase 4: Favoriten / Prüfungs-Merkliste (★):</strong> Schwierige Vokabeln markieren und gezielt abfragen.
                <br>• <strong>Phase 5: Optionales Tastatur-Schrifttraining:</strong> Zuschaltbarer Modus zum aktiven Eintippen.
              </p>
            </section>
          </article>
        </div>
      </div>
    </div>

    <!-- OFFLINE & DOWNLOAD MODAL -->
    <div v-if="showInstallModal" class="modal-backdrop" @click.self="showInstallModal = false">
      <div class="modal-box install-modal">
        <div class="modal-header">
          <h3>Offline-Nutzung & Datendownload</h3>
          <button class="modal-close-btn" @click="showInstallModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="offline-status-banner">
            <span class="status-dot green"></span>
            <div>
              <strong>{{ runtimeModeInfo.title }}</strong>
              <p>{{ runtimeModeInfo.detail }}</p>
            </div>
          </div>

          <div v-if="isTauri" class="desktop-update-modal-box">
            <h4>Desktop-App Updates (Tauri)</h4>
            <p class="modal-text" v-if="desktopUpdateNotice">{{ desktopUpdateNotice }}</p>
            <div class="modal-btn-row">
              <button
                class="btn-outline"
                @click="runDesktopUpdateCheck(true)"
                :disabled="desktopUpdateChecking"
              >
                {{ desktopUpdateChecking ? "Prüft..." : "🔄 Nach Updates suchen" }}
              </button>
            </div>
          </div>

          <h4>1. Drei Betriebsarten im Überblick</h4>
          <p class="modal-text">
            <strong>1. Browser (online):</strong> Standard-Vokabelliste direkt vom Server, unveränderlich (Lernstand lokal in <code>IndexedDB</code>).
            <br><strong>2. Browser-PWA (installiert):</strong> Eigenes App-Fenster, offline nutzbar — aktualisiert App &amp; Standard-Wortliste bei Internetverbindung vom Server (<code>.json</code>-Backup empfohlen).
            <br><strong>3. Desktop-App (Tauri · installiert):</strong> Offline mit lokaler <code>SQLite</code>-Datenbank — <strong>einzige Betriebsart für eigenen Vokabelbestand</strong> (<code>.tsv</code>-Import) inklusive Auto-Update.
          </p>
          <div v-if="!isTauri" class="modal-btn-row">
            <a
              :href="GITHUB_RELEASES_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-outline download-btn"
            >
              🖥️ Desktop-App herunterladen (macOS / Windows / Linux)
            </a>
          </div>

          <h4>2. Als Browser-PWA installieren</h4>
          <p class="modal-text" v-if="deferredInstallPrompt">
            Klicke unten, um Alexis als eigenständige Desktop- oder Mobil-App zu installieren:
          </p>
          <p class="modal-text" v-else>
            Alexis kann als Progressive Web App (PWA) direkt zum Desktop oder Home-Bildschirm hinzugefügt werden:
            <br>• <strong>Chrome / Edge:</strong> Klicke rechts oben in der Adressleiste auf das Installations-Icon.
            <br>• <strong>Safari (iOS / macOS):</strong> Im Menü auf <em>„Teilen“</em> -> <em>„Zum Home-Bildschirm hinzufügen“</em> bzw. <em>„Zum Dock hinzufügen“</em>.
          </p>
          <div v-if="deferredInstallPrompt" class="modal-btn-row">
            <button class="btn-primary" @click="triggerPwaInstall">
              📥 Jetzt als App installieren
            </button>
          </div>

          <h4>3. Lokale Vokabeldaten &amp; Backups</h4>
          <p class="modal-text">
            Sichere die Vokabeln des aktuellen Korpus oder deinen persönlichen Lernstand als JSON-Datei:
          </p>
          <div class="download-actions-grid">
            <button class="btn-outline download-btn" @click="downloadActiveCorpus">
              💾 Vokabeldatei herunterladen ({{ selectedCorpusId }}.json)
            </button>
            <button class="btn-outline download-btn" @click="exportSelectedLessonsTSV">
              📥 Aktuelle Auswahl als TSV exportieren (.tsv)
            </button>
            <button class="btn-outline download-btn" @click="downloadStudyBackup">
              📊 Lernstand & Boxen als Backup sichern (.json)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import VocabularyExplorer from "./components/VocabularyExplorer.vue";
import { HindiDictionaryProvider } from "./providers/hindiDictionary";
import { MonierWilliamsProvider } from "./providers/monierWilliams";
import {
  type HindiNounDeclension,
  type HindiVerbParadigm,
  getHindiNounDeclension,
  getHindiVerbParadigm,
} from "./services/hindiMorphology";
import { speechService } from "./services/speech";
import { downloadTSV, isTauriEnvironment, storage } from "./services/storage";
import {
  type AppUpdateInfo,
  GITHUB_RELEASES_URL,
  checkForUpdates,
  installAppUpdate,
} from "./services/updater";
import type {
  CorpusMeta,
  DeckStats,
  DictionaryResult,
  LessonData,
  StudyCardItem,
  VolumeData,
} from "./types";

// Theme & Environment
const isTauri = ref(isTauriEnvironment());
const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
const isStandalonePwa = ref(
  typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true),
);
const canImportCorpora = computed(() => isTauri.value || isLocalHost);
const runtimeModeInfo = computed(() => {
  if (isTauri.value) {
    return {
      badge: "Desktop-App · SQLite (Read-Write)",
      title: "100% Offline-fähig als Desktop-App (Tauri)",
      detail:
        "Vokabeln und Lernstände liegen dauerhaft in einer lokalen SQLite-Datenbank. Eigene TSV-Wortlisten können importiert werden.",
    };
  }
  if (isLocalHost) {
    return {
      badge: "Lokale Web-Instanz · IndexedDB (Read-Write)",
      title: "Lokaler Entwicklungs-/Redaktionsmodus",
      detail:
        "Vokabeln und Lernstände liegen lokal in IndexedDB. TSV-Import ist auf localhost freigeschaltet.",
    };
  }
  if (isStandalonePwa.value) {
    return {
      badge: "PWA · Wortschatz Read-Only",
      title: "100% Offline-fähig als installierte PWA",
      detail:
        "Kuratierter Wortschatz (Read-Only); dein Lernstand (Boxen 1–5) liegt lokal in IndexedDB. Bitte regelmäßig ein JSON-Backup sichern.",
    };
  }
  return {
    badge: "Browser · Wortschatz Read-Only",
    title: "100% Offline-fähig im Browser (PWA)",
    detail:
      "Kuratierter Wortschatz (Read-Only); dein Lernstand (Boxen 1–5) liegt lokal in IndexedDB. Bitte regelmäßig ein JSON-Backup sichern.",
  };
});
const currentTheme = ref<"light" | "dark">("light");
const isEmbedded = ref(false);

// Navigation Tabs
type Tab = "trainer" | "explorer" | "corpora" | "dictionary" | "stats";
const currentTab = ref<Tab>("trainer");

// Corpora & Gliederung State
const corporaList = ref<CorpusMeta[]>([]);
const selectedCorpusId = ref<string>("hindi-bolo");
const volumesList = ref<VolumeData[]>([]);
const selectedVolumeIds = ref<string[]>(["hb1"]);
const lessonsList = ref<LessonData[]>([]);
const selectedLessonIds = ref<string[]>([]);
const dueOnly = ref(false);

const filteredLessons = computed(() => {
  let list = lessonsList.value.filter((l) => (l.entry_count ?? 0) > 0);
  if (selectedVolumeIds.value.length > 0) {
    list = list.filter((l) => selectedVolumeIds.value.includes(l.volume_id));
  }
  return list;
});

function getVolumeTitle(volId: string): string {
  const v = volumesList.value.find((vol) => vol.id === volId);
  return v ? v.title : volId;
}

// Study Session Queue State
const queue = ref<StudyCardItem[]>([]);
const currentIndex = ref<number>(0);
const isFlipped = ref<boolean>(false);
const showTranslit = ref<boolean>(true);

// Study Direction: target-to-de (Hindi -> DE) or de-to-target (DE -> Hindi)
type StudyDirection = "target-to-de" | "de-to-target";
const savedDirection =
  typeof localStorage !== "undefined"
    ? (localStorage.getItem("alexis_study_direction") as StudyDirection | null)
    : null;
const studyDirection = ref<StudyDirection>(
  savedDirection === "de-to-target" ? "de-to-target" : "target-to-de",
);

const targetLangLabel = computed(() => {
  const corp = corporaList.value.find((c) => c.id === selectedCorpusId.value);
  if (!corp) return "Hindi";
  if (corp.lang_code === "hi") return "Hindi";
  if (corp.lang_code === "sa") return "Sanskrit";
  return corp.title;
});

const directionLabel = computed(() => {
  if (studyDirection.value === "target-to-de") {
    return `${targetLangLabel.value} ➔ DE`;
  }
  return `DE ➔ ${targetLangLabel.value}`;
});

function toggleDirection() {
  studyDirection.value =
    studyDirection.value === "target-to-de" ? "de-to-target" : "target-to-de";
  isFlipped.value = false;
  try {
    localStorage.setItem("alexis_study_direction", studyDirection.value);
  } catch {}
}

// Study Ordering: Alphabetical / Sequential vs. Random (Shuffle)
const isShuffle = ref(
  typeof localStorage !== "undefined"
    ? localStorage.getItem("alexis_shuffle") === "true"
    : false,
);

function toggleShuffle() {
  isShuffle.value = !isShuffle.value;
  try {
    localStorage.setItem("alexis_shuffle", isShuffle.value ? "true" : "false");
  } catch {}
  reloadQueue(dueOnly.value);
}

// Dictionary State
const mwProvider = new MonierWilliamsProvider();
const hindiDictProvider = new HindiDictionaryProvider();
const dictLang = ref<"sa" | "hi">("hi");
const dictQuery = ref("");
const dictLoading = ref(false);
const dictResults = ref<DictionaryResult[]>([]);

// Stats State
const deckStats = ref<DeckStats | null>(null);

// Computed Helpers
const activeCorpus = computed(() => {
  return corporaList.value.find((c) => c.id === selectedCorpusId.value);
});

const activeCorpusTitle = computed(() => {
  return activeCorpus.value ? activeCorpus.value.title : selectedCorpusId.value;
});

const isHindi = computed<boolean>(() => {
  if (currentCard.value) {
    const cId = (currentCard.value.corpus_id || "").toLowerCase();
    if (cId.includes("hindi")) return true;
  }
  const corp = activeCorpus.value;
  if (!corp) return false;
  return corp.lang_code === "hi" || corp.id.toLowerCase().includes("hindi");
});

const showGrammarDrawer = ref(
  localStorage.getItem("alexis_show_grammar_drawer") !== "false",
);

function toggleGrammarDrawer() {
  showGrammarDrawer.value = !showGrammarDrawer.value;
  localStorage.setItem(
    "alexis_show_grammar_drawer",
    String(showGrammarDrawer.value),
  );
}

const hindiNounDeclension = computed<HindiNounDeclension | null>(() => {
  if (!isHindi.value || !currentCard.value) return null;
  const p = (currentCard.value.pos || "").toLowerCase();
  const isN =
    p === "noun" ||
    p === "subst" ||
    p === "n" ||
    (currentCard.value.gender &&
      !currentCard.value.lemma_native.endsWith("ना"));

  if (!isN) return null;

  return getHindiNounDeclension(
    currentCard.value.lemma_native,
    currentCard.value.lemma_translit,
    currentCard.value.gender,
  );
});

const hindiVerbParadigm = computed<HindiVerbParadigm | null>(() => {
  if (!isHindi.value || !currentCard.value) return null;
  const p = (currentCard.value.pos || "").toLowerCase();
  const isV =
    p === "verb" ||
    p === "v" ||
    (currentCard.value.lemma_native.endsWith("ना") &&
      (currentCard.value.tags?.some((t) => t.includes("verb")) ||
        (!currentCard.value.gender && p !== "noun" && p !== "adj")));

  if (!isV) return null;

  return getHindiVerbParadigm(
    currentCard.value.lemma_native,
    currentCard.value.lemma_translit,
  );
});

const selectedVolumesSummary = computed(() => {
  if (selectedLessonIds.value.length > 0) {
    const selectedLessons = lessonsList.value.filter((l) =>
      selectedLessonIds.value.includes(l.id),
    );
    if (selectedLessons.length === 1) {
      return selectedLessons[0].title;
    }
    if (selectedLessons.length <= 3) {
      return selectedLessons
        .map((l) => {
          const m = l.title.match(/^(Lektion\s+\d+)/i);
          return m ? m[1] : l.title;
        })
        .join(", ");
    }
    return `${selectedLessons.length} Lektionen (${selectedLessons
      .map((l) => {
        const m = l.title.match(/\d+/);
        return m ? `L${m[0]}` : l.id;
      })
      .slice(0, 4)
      .join(", ")}${selectedLessons.length > 4 ? "…" : ""})`;
  }
  if (selectedVolumeIds.value.length === 0) return "Keine Gliederung";
  if (
    selectedVolumeIds.value.length === volumesList.value.length &&
    volumesList.value.length > 0
  ) {
    return `Alle Bände (1–${volumesList.value.length})`;
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

// Linguistic format helpers
function formatGender(gender?: string | null): string {
  if (!gender || gender === "-") return "m./f. unbestimmt";
  const g = gender.toLowerCase().trim();
  if (g === "m") return "m. (Maskulinum)";
  if (g === "f") return "f. (Femininum)";
  if (g === "n") return "n. (Neutrum)";
  if (g === "m/f") return "m./f. (Maskulin / Feminin)";
  return `${gender}.`;
}

function formatGenderShort(gender?: string | null): string {
  if (!gender || gender === "-") return "";
  const g = gender.toLowerCase().trim();
  if (g === "m") return "m.";
  if (g === "f") return "f.";
  if (g === "n") return "n.";
  if (g === "m/f") return "m./f.";
  return `${gender}.`;
}

function formatPos(pos?: string | null): string {
  if (!pos) return "";
  const p = pos.toLowerCase().trim();
  switch (p) {
    case "noun":
    case "subst":
      return "Substantiv";
    case "verb":
      return "Verb";
    case "adj":
      return "Adjektiv";
    case "adv":
      return "Adverb";
    case "pron":
      return "Pronomen";
    case "num":
      return "Zahlwort";
    case "interj":
      return "Interjektion";
    case "konj":
    case "conj":
      return "Konjunktion";
    case "ptk":
    case "part":
      return "Partikel";
    case "postp":
      return "Postposition";
    case "ind":
      return "Indeklinabel";
    default:
      return pos;
  }
}

// Speech Synthesis helper
function speakCurrentCard() {
  if (!currentCard.value) return;
  const lang = activeCorpus.value?.lang_code || (isHindi.value ? "hi" : "sa");
  speechService.speak(currentCard.value.lemma_native, lang);
}

// Theme Toggle
function toggleTheme() {
  currentTheme.value = currentTheme.value === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme.value);
}

// Keyboard Shortcut Handler for Spaced Repetition Study
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target?.isContentEditable
  ) {
    return;
  }

  if (currentTab.value !== "trainer" || !currentCard.value) return;

  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    if (!isFlipped.value) {
      isFlipped.value = true;
    } else {
      submitRating(3); // Space on revealed card votes "Gut"
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (!isFlipped.value) {
      isFlipped.value = true;
    }
  } else if (isFlipped.value) {
    if (e.key === "1") {
      e.preventDefault();
      submitRating(1);
    } else if (e.key === "2") {
      e.preventDefault();
      submitRating(2);
    } else if (e.key === "3") {
      e.preventDefault();
      submitRating(3);
    } else if (e.key === "4") {
      e.preventDefault();
      submitRating(4);
    }
  }

  if (e.key === "u" || e.key === "U" || e.key === "t" || e.key === "T") {
    showTranslit.value = !showTranslit.value;
  } else if (e.key === "v" || e.key === "V") {
    e.preventDefault();
    speakCurrentCard();
  } else if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    toggleDirection();
  } else if (e.key === "s" || e.key === "S") {
    e.preventDefault();
    toggleShuffle();
  } else if (e.key === "g" || e.key === "G") {
    if (
      isFlipped.value &&
      isHindi.value &&
      (hindiNounDeclension.value || hindiVerbParadigm.value)
    ) {
      e.preventDefault();
      toggleGrammarDrawer();
    }
  }
}

// Modal States
const showHelpModal = ref(false);

// Help Modal Section State
const activeHelpSection = ref<string>("sec-1");
const helpSections = [
  { id: "sec-1", title: "1. Datensouveränität & Architektur", num: "1" },
  { id: "sec-2", title: "2. Leitner-System & 4 Tasten", num: "2" },
  { id: "sec-3", title: "3. Sprachausgabe (TTS)", num: "3" },
  { id: "sec-4", title: "4. Vokabel-Explorer & Umschrift", num: "4" },
  { id: "sec-5", title: "5. Grammatik, Richtung & Shuffle", num: "5" },
  { id: "sec-6", title: "6. Tastaturkürzel-Referenz", num: "6" },
  { id: "sec-7", title: "7. TSV-Spezifikation", num: "7" },
  { id: "sec-8", title: "8. Anki-Vergleich & Roadmap", num: "8" },
];

function selectHelpSection(id: string) {
  activeHelpSection.value = id;
}
const showInstallModal = ref(false);
const deferredInstallPrompt = ref<any>(null);

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  deferredInstallPrompt.value = e;
}

function handleOfflineOrInstall() {
  showInstallModal.value = true;
}

async function triggerPwaInstall() {
  if (deferredInstallPrompt.value) {
    deferredInstallPrompt.value.prompt();
    const { outcome } = await deferredInstallPrompt.value.userChoice;
    if (outcome === "accepted") {
      deferredInstallPrompt.value = null;
    }
  }
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadActiveCorpus() {
  const bundle = storage.getCorpusBundle(selectedCorpusId.value);
  if (bundle) {
    downloadJSON(bundle, `${selectedCorpusId.value}_vokabeln.json`);
  }
}

function downloadStudyBackup() {
  const backup = storage.exportStudyBackup();
  downloadJSON(
    backup,
    `alexis_lernstand_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
}

async function exportSingleLessonTSV(les: LessonData) {
  const content = await storage.exportSelectionTSV(
    selectedCorpusId.value,
    [les.volume_id],
    [les.id],
  );
  const safeTitle = les.title.toLowerCase().replace(/\s+/g, "_");
  const filename = `${selectedCorpusId.value}_${les.volume_id}_${safeTitle}.tsv`;
  downloadTSV(content, filename);
}

async function exportSelectedLessonsTSV() {
  const vIds =
    selectedVolumeIds.value.length > 0 ? selectedVolumeIds.value : undefined;
  const lIds =
    selectedLessonIds.value.length > 0 ? selectedLessonIds.value : undefined;
  const content = await storage.exportSelectionTSV(
    selectedCorpusId.value,
    vIds,
    lIds,
  );
  const countDesc =
    selectedLessonIds.value.length > 0
      ? `${selectedLessonIds.value.length}lektionen`
      : "auswahl";
  const filename = `${selectedCorpusId.value}_${countDesc}_${new Date().toISOString().slice(0, 10)}.tsv`;
  downloadTSV(content, filename);
}

// Lifecycle Init
onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

  // Check embed parameter from URL
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") === "true" || window.self !== window.top) {
    isEmbedded.value = true;
  }

  // Load available corpora
  corporaList.value = await storage.listCorpora();
  if (corporaList.value.length > 0) {
    const initialCorpus = params.get("corpus") || "hindi-bolo";
    await selectCorpus(initialCorpus);
  }

  // Handle lesson/volume params
  const volParam = params.get("volume");
  if (volParam) {
    selectedVolumeIds.value = [volParam];
  }
  const lesParam = params.get("lesson");
  if (lesParam) {
    selectedLessonIds.value = [lesParam];
  }

  // Load queue
  await reloadQueue(false);
  await refreshStats();

  if (isTauri.value) {
    desktopUpdateTimer = setTimeout(() => {
      runDesktopUpdateCheck(false);
    }, 4000);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  if (desktopUpdateTimer) {
    clearTimeout(desktopUpdateTimer);
    desktopUpdateTimer = null;
  }
});

// Desktop Auto-Updater (Tauri)
const desktopUpdateInfo = shallowRef<AppUpdateInfo | null>(null);
const desktopUpdateChecking = ref(false);
const desktopUpdateInstalling = ref(false);
const desktopUpdateProgress = ref<number | null>(null);
const desktopUpdateNotice = ref("");
const desktopUpdateDismissed = ref(false);
let desktopUpdateTimer: ReturnType<typeof setTimeout> | null = null;

async function runDesktopUpdateCheck(manual: boolean) {
  if (!isTauri.value || desktopUpdateChecking.value) return;
  desktopUpdateChecking.value = true;
  if (manual) {
    desktopUpdateNotice.value = "";
  }
  try {
    const info = await checkForUpdates();
    desktopUpdateInfo.value = info;
    if (info.available) {
      desktopUpdateDismissed.value = false;
      desktopUpdateNotice.value = `Version v${info.version} verfügbar.`;
    } else if (manual) {
      desktopUpdateNotice.value = info.error
        ? `Update-Prüfung fehlgeschlagen: ${info.error}`
        : "Du nutzt bereits die neueste Version.";
    }
  } finally {
    desktopUpdateChecking.value = false;
  }
}

async function installDesktopUpdate() {
  const update = desktopUpdateInfo.value?.update;
  if (!update || desktopUpdateInstalling.value) return;
  desktopUpdateInstalling.value = true;
  desktopUpdateProgress.value = 0;
  try {
    await installAppUpdate(update, (downloaded, total) => {
      if (total && total > 0) {
        desktopUpdateProgress.value = Math.min(
          100,
          Math.round((downloaded / total) * 100),
        );
      }
    });
    desktopUpdateNotice.value =
      "Update installiert. Bitte App neu starten, um die neue Version zu aktivieren.";
  } catch (err: unknown) {
    desktopUpdateNotice.value = `Installation fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    desktopUpdateInstalling.value = false;
  }
}

// Selection Logic
async function selectCorpus(corpusId: string) {
  selectedCorpusId.value = corpusId;
  volumesList.value = await storage.listVolumes(corpusId);
  lessonsList.value = await storage.listLessons(corpusId);
  selectedLessonIds.value = [];
  // Default: select only first volume (e.g. Hindi bolo 1)
  if (volumesList.value.length > 0) {
    selectedVolumeIds.value = [volumesList.value[0].id];
  } else {
    selectedVolumeIds.value = [];
  }
}

const importNotice = ref<string>("");

async function handleFileUpload(e: Event) {
  if (!canImportCorpora.value) return;
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  const text = await file.text();
  const count = await storage.importTSV(text, selectedCorpusId.value);
  importNotice.value = `${count} Vokabeln aus "${file.name}" erfolgreich importiert!`;
  volumesList.value = await storage.listVolumes(selectedCorpusId.value);
  lessonsList.value = await storage.listLessons(selectedCorpusId.value);
  if (selectedVolumeIds.value.length === 0) {
    selectedVolumeIds.value = volumesList.value.map((v) => v.id);
  }
  await reloadQueue(false);
  await refreshStats();
  target.value = "";
  setTimeout(() => {
    importNotice.value = "";
  }, 4000);
}

function selectAllVolumes() {
  selectedVolumeIds.value = volumesList.value.map((v) => v.id);
  selectedLessonIds.value = [];
}

async function startSessionWithSelectedVolumes() {
  await reloadQueue(dueOnly.value);
  currentTab.value = "trainer";
}

function startSessionWithItems(items: StudyCardItem[]) {
  queue.value = [...items];
  currentIndex.value = 0;
  isFlipped.value = false;
  currentTab.value = "trainer";
}

async function reloadQueue(onlyDue: boolean) {
  currentIndex.value = 0;
  isFlipped.value = false;
  queue.value = await storage.getStudyQueue({
    corpus_id: selectedCorpusId.value,
    volume_ids:
      selectedVolumeIds.value.length > 0 ? selectedVolumeIds.value : undefined,
    lesson_ids:
      selectedLessonIds.value.length > 0 ? selectedLessonIds.value : undefined,
    due_only: onlyDue,
    shuffle: isShuffle.value,
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
let dictSearchSeq = 0;

function openDictionaryTab() {
  if (dictResults.value.length === 0 && !dictQuery.value.trim()) {
    dictLang.value = activeCorpus.value?.lang_code === "hi" ? "hi" : "sa";
  }
  currentTab.value = "dictionary";
}

function selectDictLang(lang: "sa" | "hi") {
  dictSearchSeq += 1;
  dictLang.value = lang;
  dictLoading.value = false;
  dictResults.value = [];
}

async function performDictSearch() {
  const query = dictQuery.value.trim();
  if (!query) return;
  const seq = ++dictSearchSeq;
  dictLoading.value = true;
  try {
    const provider = dictLang.value === "hi" ? hindiDictProvider : mwProvider;
    const results = await provider.lookup(query);
    if (seq !== dictSearchSeq) return;
    dictResults.value = results;
  } finally {
    if (seq === dictSearchSeq) {
      dictLoading.value = false;
    }
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
  gap: 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.88rem;
  min-height: 2.2rem;
}

.trainer-context {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 500;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
}

.context-corpus {
  flex-shrink: 0;
  color: var(--text-primary);
  font-weight: 600;
}

.context-sep {
  flex-shrink: 0;
  color: var(--text-muted);
}

.context-volumes {
  color: var(--accent-gold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trainer-controls {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.direction-toggle-btn,
.shuffle-toggle-btn,
.explorer-jump-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  height: 32px;
  border-radius: 6px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.direction-toggle-btn:hover,
.shuffle-toggle-btn:hover,
.explorer-jump-btn:hover {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

.explorer-jump-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.explorer-jump-badge {
  letter-spacing: 0.02em;
}

.direction-swap-icon {
  font-size: 0.95rem;
  color: var(--accent-gold);
}

.direction-badge {
  letter-spacing: 0.02em;
}

.shuffle-toggle-btn.active {
  background-color: var(--bg-surface);
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  box-shadow: 0 0 0 1px var(--accent-gold) inset;
}

.shuffle-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.trainer-counter {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: 0.35rem;
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

.box-badge,
.volume-badge,
.pos-badge,
.gender-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.55rem;
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

.pos-badge {
  font-weight: 500;
  color: var(--text-secondary);
}

.gender-badge {
  font-weight: 600;
}

.gender-badge.gender-m,
.def-gender-pill.gender-m {
  background-color: var(--gender-m-bg);
  color: var(--gender-m-text);
  border-color: var(--gender-m-border);
}

.gender-badge.gender-f,
.def-gender-pill.gender-f {
  background-color: var(--gender-f-bg);
  color: var(--gender-f-text);
  border-color: var(--gender-f-border);
}

.gender-badge.gender-n,
.def-gender-pill.gender-n {
  background-color: var(--gender-n-bg);
  color: var(--gender-n-text);
  border-color: var(--gender-n-border);
}

.gender-badge.gender-m-f,
.def-gender-pill.gender-m-f {
  background-color: var(--bg-surface);
  color: var(--accent-gold);
  border-color: var(--accent-gold);
}

.gender-badge.gender-prompt {
  border-style: dashed;
  color: var(--text-muted);
  background-color: var(--bg-surface);
}

.native-script-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  margin: 0.5rem 0;
}

.native-script {
  font-size: 3.2rem;
  color: var(--text-primary);
  line-height: 1.2;
}

.btn-audio-speak {
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  color: var(--accent-gold);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(3, 25, 46, 0.06);
}

.btn-audio-speak .speaker-icon {
  width: 20px;
  height: 20px;
}

.btn-audio-speak:hover {
  background-color: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
  transform: scale(1.06);
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

.de-prompt {
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.de-prompt-meanings {
  font-family: var(--font-serif);
  font-size: 2.2rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.25;
}

.de-prompt-item {
  display: block;
}

.de-prompt-notes {
  font-size: 0.92rem;
  color: var(--text-muted);
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

.target-reveal-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.target-reveal-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 0.5rem 0 1rem;
}

.target-reveal-de {
  font-size: 1.1rem;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-style: italic;
}

.def-meaning {
  font-size: 1.4rem;
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.def-gender-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 4px;
  border: 1px solid transparent;
}

.def-notes {
  font-size: 0.88rem;
  color: var(--text-muted);
}

/* Hindi Grammar Section (Noun Declension & Verb Paradigms) */
.grammar-section {
  margin-top: 1.25rem;
  width: 100%;
  text-align: left;
}

.grammar-box {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.grammar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  user-select: none;
  gap: 0.5rem;
}

[data-theme="dark"] .grammar-header {
  background: rgba(255, 255, 255, 0.03);
}

.grammar-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  flex-wrap: wrap;
}

.grammar-icon {
  font-size: 1rem;
}

.grammar-name {
  color: var(--text-primary);
}

.grammar-toggle-btn {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.25rem 0.55rem;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.grammar-toggle-btn:hover {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

.grammar-content {
  padding: 0.85rem;
}

/* Noun Declension Table */
.declension-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.declension-table th {
  text-align: left;
  padding: 0.45rem 0.6rem;
  border-bottom: 2px solid var(--border-subtle);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.declension-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.declension-table tr:last-child td {
  border-bottom: none;
}

.cell-kasus {
  color: var(--text-primary);
  width: 30%;
}

.kasus-sub {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: normal;
  margin-top: 0.1rem;
}

.cell-form {
  line-height: 1.3;
}

.cell-form .form-deva {
  display: block;
  font-family: var(--font-deva);
  font-size: 1.15rem;
  color: var(--text-primary);
}

.cell-form .form-translit {
  display: block;
  font-size: 0.8rem;
  color: var(--accent-gold);
  font-style: italic;
}

.grammar-rule-hint {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--text-secondary);
  background: rgba(180, 83, 9, 0.06);
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  border-left: 3px solid var(--accent-gold);
}

.hint-sub {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Ergative & Verb Badges */
.ne-badge,
.ne-badge-top {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.ne-badge-top {
  margin-left: 0.25rem;
}

.badge-transitive {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

[data-theme="dark"] .badge-transitive {
  background: #064e3b;
  color: #86efac;
  border-color: #059669;
}

.badge-intransitive {
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

[data-theme="dark"] .badge-intransitive {
  background: #082f49;
  color: #7dd3fc;
  border-color: #0284c7;
}

.badge-special {
  background: #f3e8ff;
  color: #6b21a8;
  border: 1px solid #e9d5ff;
}

[data-theme="dark"] .badge-special {
  background: #3b0764;
  color: #d8b4fe;
  border-color: #7e22ce;
}

.ne-explanation-box {
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--text-secondary);
  background: rgba(3, 25, 46, 0.03);
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #2563eb;
  margin-bottom: 0.75rem;
}

[data-theme="dark"] .ne-explanation-box {
  background: rgba(255, 255, 255, 0.04);
  border-left-color: #3b82f6;
}

/* Verb Grid */
.verb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.65rem;
}

.verb-cell {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.verb-cell-wide {
  grid-column: 1 / -1;
}

.verb-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.verb-deva {
  font-family: var(--font-deva);
  font-size: 1.05rem;
  color: var(--text-primary);
  line-height: 1.3;
}

.verb-translit {
  font-size: 0.8rem;
  color: var(--accent-gold);
  font-style: italic;
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

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.vol-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.vol-count {
  font-weight: 600;
  color: var(--accent-gold);
}

.vol-level {
  color: var(--text-muted);
}

/* Lessons Subpanel */
.lessons-subpanel {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px dashed var(--border-subtle);
}

.subpanel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.subpanel-header h4 {
  font-size: 0.9rem;
  font-family: var(--font-sans);
  color: var(--text-secondary);
}

.lessons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.lesson-checkbox-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.lesson-checkbox-card.checked {
  border-color: var(--accent-gold);
}

.les-checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  flex: 1;
}

.btn-tsv-export {
  padding: 0.2rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-tsv-export:hover {
  background: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
}

.btn-link.highlight-action {
  color: var(--accent-gold);
  font-weight: 600;
}

.les-info {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.les-title {
  font-size: 0.85rem;
  font-weight: 500;
}

.les-count {
  font-size: 0.75rem;
  color: var(--accent-gold);
}

.filter-options {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox-inline input[type="checkbox"],
.volume-checkbox-card input[type="checkbox"],
.lesson-checkbox-card input[type="checkbox"] {
  cursor: pointer;
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--accent-gold);
}

.start-session-bar {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.explorer-quick-btn {
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 6px;
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.explorer-quick-btn:hover:not(:disabled) {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

/* Dictionary */
.dict-provider-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dict-provider-btn {
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-elevated);
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
}

.dict-provider-btn.active {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  font-weight: 600;
}

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

.dict-translit {
  font-weight: 400;
  font-size: 0.95rem;
  color: var(--text-muted);
}

.dict-source {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dict-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.dict-link {
  color: var(--accent-gold);
  font-size: 0.85rem;
  text-decoration: none;
}

.runtime-mode-pill {
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  color: var(--text-muted);
}

.desktop-update-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1.5rem;
  background-color: var(--bg-surface-elevated);
  border-bottom: 1px solid var(--accent-gold);
}

.desktop-update-text {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.desktop-update-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.desktop-update-modal-box {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
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
  cursor: pointer;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.import-notice-banner {
  background-color: var(--bg-surface);
  border: 1px solid var(--accent-gold);
  color: var(--accent-gold);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

/* Modals (Help & Offline/Download) */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(3, 25, 46, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  max-width: 680px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

/* VitePress-Style Help Modal Layout */
.modal-box.help-modal-doc {
  max-width: 1060px;
  width: 95vw;
  height: 86vh;
  max-height: 86vh;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  flex-shrink: 0;
}

.doc-header-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.doc-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.18rem 0.45rem;
  border-radius: 4px;
  background-color: var(--accent-gold);
  color: #ffffff;
}

.doc-header-title h3 {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  margin: 0;
  color: var(--text-primary);
}

.doc-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Linke VitePress-Seitenleiste */
.doc-sidebar {
  width: 280px;
  flex-shrink: 0;
  background-color: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.doc-sidebar-group {
  padding: 1rem 0.75rem;
}

.doc-group-title {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 0 0.5rem 0.65rem;
  display: block;
}

.doc-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.doc-nav-item {
  border-radius: 6px;
}

.doc-nav-btn {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.55rem 0.65rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
  line-height: 1.35;
  transition: all 0.15s ease;
}

.doc-nav-num {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 600;
  flex-shrink: 0;
}

.doc-nav-label {
  flex: 1;
}

.doc-nav-btn:hover {
  background-color: var(--bg-surface-elevated);
  color: var(--text-primary);
}

.doc-nav-item.active .doc-nav-btn {
  background-color: var(--bg-surface-elevated);
  color: var(--accent-gold);
  border-color: var(--border-subtle);
  font-weight: 600;
}

.doc-nav-item.active .doc-nav-num {
  background-color: var(--accent-gold);
  color: #ffffff;
  border-color: var(--accent-gold);
}

.doc-sidebar-footer {
  padding: 0.85rem 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.doc-version-tag {
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* Rechter VitePress-Lesebereich */
.doc-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 1.75rem 2.25rem;
  background-color: var(--bg-surface-elevated);
}

.doc-section {
  max-width: 54rem;
  margin: 0 auto;
}

.doc-crumb {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent-gold);
  margin-bottom: 0.4rem;
}

.doc-section h4 {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  color: var(--text-primary);
  margin: 0 0 1rem;
  line-height: 1.3;
}

.doc-callout {
  background-color: var(--bg-surface);
  border-left: 3px solid var(--accent-gold);
  padding: 0.75rem 1rem;
  border-radius: 0 6px 6px 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 1rem 0;
}

@media (max-width: 768px) {
  .doc-layout {
    flex-direction: column;
  }
  .doc-sidebar {
    width: 100%;
    max-height: 160px;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
  }
  .doc-content {
    padding: 1.25rem;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.15rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h3 {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  margin: 0;
  color: var(--text-primary);
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.modal-close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-body h4 {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  color: var(--text-primary);
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.modal-text {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0;
}

.help-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
  margin: 0.5rem 0 1rem;
  text-align: left;
}

.help-table th,
.help-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.help-table th {
  background-color: var(--bg-surface);
  color: var(--text-muted);
  font-weight: 600;
}

.help-table td {
  color: var(--text-primary);
}

.help-list {
  margin: 0.25rem 0 0.5rem 1.25rem;
  padding: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.offline-status-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 8px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}

.offline-status-banner p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 0.35rem;
  flex-shrink: 0;
}

.status-dot.green {
  background-color: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.modal-btn-row {
  margin: 0.75rem 0;
}

.download-actions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  background-color: var(--bg-surface);
}

.download-btn:hover {
  border-color: var(--accent-gold);
}
</style>
