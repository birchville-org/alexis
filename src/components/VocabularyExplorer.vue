<template>
  <section class="vocabulary-explorer" :class="{ 'interlinear-active': interlinearMode }">
    <!-- Explorer Header & Summary -->
    <div class="explorer-header">
      <div class="header-titles">
        <h2>Vokabel-Explorer & Gesamtschau</h2>
        <p class="header-desc">
          Vollständiges Verzeichnis aller Vokabeln für <strong>{{ corpusTitle }}</strong>.
          Durchsuchen, filtern und studieren ohne Bewertungszwang.
        </p>
        <p v-if="!canEditCorpora" class="readonly-mode-hint">
          🔒 <strong>Server-Ansicht (Referenz-Datensatz):</strong> Prüf- und Editierfunktionen am Wortschatz sind hier ausgeschaltet. Für individuelle, lokal editierbare Datensätze bitte Alexis als
          <button type="button" class="btn-inline-link" @click="emit('open-install-info')">PWA installieren oder die Desktop-App nutzen</button>.
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
          v-if="canEditCorpora"
          class="btn-copy-tsv"
          :disabled="filteredEntries.length === 0 || auditRunning"
          @click="runOnlineAudit"
          title="Prüft die aktuelle Vokabelliste gegen Wiktionary / Cologne MW auf Korrektheit"
        >
          🔎 Online prüfen ({{ filteredEntries.length }})
        </button>
        <button
          v-if="canEditCorpora && !isReviewMode && pendingDeltaItems.length > 0"
          type="button"
          class="btn-copy-tsv"
          @click="downloadReviewDelta"
          title="Lokale Korrekturen als Delta-Datei (.json) exportieren"
        >
          📤 Delta exportieren ({{ pendingDeltaItems.length }})
        </button>
        <label
          v-if="canEditCorpora && !isReviewMode"
          class="btn-copy-tsv upload-delta-label"
          title="Lädt ein Korrektur-Delta (.json) eines Gutachters zur Prüfung und selektiven Übernahme"
        >
          📥 Delta prüfen
          <input
            type="file"
            accept=".json,application/json"
            style="display:none"
            @change="handleDeltaFileUpload"
          />
        </label>
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

    <div v-if="isReviewMode && canEditCorpora" class="reviewer-banner">
      <div class="reviewer-banner-text">
        <strong>📝 Gutachter-Modus:</strong>
        <span>{{ pendingDeltaItems.length }} Änderung(en) gegenüber dem Referenzkorpus lokal vorgemerkt (Server bleibt unverändert).</span>
      </div>
      <div class="reviewer-banner-actions">
        <button
          v-if="pendingDeltaItems.length > 0"
          type="button"
          class="btn-outline-sm btn-no-mt"
          @click="discardStagedOverrides"
        >
          ↺ Verwerfen
        </button>
        <button
          type="button"
          class="btn-primary-sm"
          :disabled="pendingDeltaItems.length === 0"
          @click="downloadReviewDelta"
        >
          📤 Korrektur-Delta herunterladen (.json) ({{ pendingDeltaItems.length }})
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

      <!-- Interlinear IAST Toggle -->
      <div class="filter-group">
        <label class="filter-label">Lesehilfe:</label>
        <button
          type="button"
          :class="['pill-btn', { active: interlinearMode }]"
          :aria-pressed="interlinearMode"
          @click="interlinearMode = !interlinearMode"
          title="Zeigt IAST-Umschrift interlinear unter Devanāgarī-Formen (Tabelle, Detailansicht & Paradigmen)"
        >
          अ + IAST Interlinear
        </button>
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
                  <span class="lemma-highlight">
                    <InterlinearText
                      :text="item.lemma_native"
                      :lang="iastLangMode"
                      :enabled="interlinearMode"
                    />
                  </span>
                  <button
                    class="btn-table-speak"
                    @click.stop="speakItem(item)"
                    title="Aussprache anhören"
                    aria-label="Aussprache anhören"
                  >
                    <svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
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
                <div
                  v-if="(item.tags && item.tags.length > 0) || item.user_note || item.definitions.some((d) => d.notes)"
                  class="item-tags"
                >
                  <span v-for="tag in (item.tags || []).slice(0, 3)" :key="tag" class="tag-pill">
                    #{{ tag }}
                  </span>
                  <span
                    v-if="item.user_note || item.definitions.some((d) => d.notes)"
                    class="note-pill"
                    :title="formatCombinedNotes(item.definitions, item.user_note)"
                  >
                    📝 Notiz
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
    <div v-if="selectedEntry" class="detail-modal-backdrop" @click="closeEntryDetail">
      <div class="detail-modal-card" @click.stop>
        <div class="modal-header">
          <div class="modal-lemma-block">
            <span class="modal-native script-deva">
              <InterlinearText
                :text="selectedEntry.lemma_native"
                :lang="iastLangMode"
                :enabled="interlinearMode"
              />
            </span>
            <span class="modal-translit">{{ selectedEntry.lemma_translit }}</span>
            <button
              class="btn-modal-speak"
              @click.stop="speakItem(selectedEntry)"
              title="Aussprache anhören"
              aria-label="Aussprache anhören"
            >
              <svg class="speaker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>
          <button class="modal-close-btn" @click="closeEntryDetail" title="Schließen">✕</button>
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
              <div class="modal-meanings-head">
                <h4>Bedeutung(en):</h4>
                <span v-if="entryEditSaved" class="note-saved-badge">✓ Gespeichert</span>
                <button
                  v-if="canEditCorpora && !editingEntry"
                  type="button"
                  class="btn-outline-sm btn-no-mt"
                  @click="startEntryEdit"
                >
                  ✏️ Eintrag bearbeiten
                </button>
              </div>

              <template v-if="canEditCorpora && editingEntry">
                <div class="entry-edit-form">
                  <div class="entry-edit-grid">
                    <label class="entry-edit-field">
                      <span>Devanāgarī / Nativschrift</span>
                      <input
                        v-model="editNativeDraft"
                        type="text"
                        class="entry-edit-input script-deva"
                      />
                    </label>
                    <label class="entry-edit-field">
                      <span>Umschrift (IAST)</span>
                      <input
                        v-model="editTranslitDraft"
                        type="text"
                        class="entry-edit-input"
                      />
                    </label>
                  </div>

                  <div class="entry-edit-grid">
                    <label class="entry-edit-field">
                      <span>Wortart</span>
                      <select v-model="editPosDraft" class="entry-edit-input">
                        <option value="">–</option>
                        <option value="noun">noun (Substantiv)</option>
                        <option value="verb">verb (Verb)</option>
                        <option value="adj">adj (Adjektiv)</option>
                        <option value="adv">adv (Adverb)</option>
                        <option value="pron">pron (Pronomen)</option>
                        <option value="num">num (Zahlwort)</option>
                        <option value="postp">postp (Postposition)</option>
                        <option value="conj">conj (Konjunktion)</option>
                        <option value="part">part (Partikel)</option>
                        <option value="interj">interj (Interjektion)</option>
                        <option value="ind">ind (Indeklinabile)</option>
                        <option
                          v-if="editPosDraft && !['noun','verb','adj','adv','pron','num','postp','conj','part','interj','ind'].includes(editPosDraft)"
                          :value="editPosDraft"
                        >
                          {{ editPosDraft }}
                        </option>
                      </select>
                    </label>
                    <label class="entry-edit-field">
                      <span>Genus</span>
                      <select v-model="editGenderDraft" class="entry-edit-input">
                        <option value="">–</option>
                        <option value="m">m (Maskulinum)</option>
                        <option value="f">f (Femininum)</option>
                        <option value="n">n (Neutrum)</option>
                        <option value="m/f">m/f (Maskulin / Feminin)</option>
                      </select>
                    </label>
                  </div>

                  <div
                    v-for="(defDraft, dIdx) in editDefinitionsDraft"
                    :key="dIdx"
                    class="entry-edit-grid"
                  >
                    <label class="entry-edit-field">
                      <span>Deutsche Bedeutung{{ editDefinitionsDraft.length > 1 ? ` (${dIdx + 1})` : '' }}</span>
                      <input
                        v-model="defDraft.meaning"
                        type="text"
                        class="entry-edit-input"
                      />
                    </label>
                    <label class="entry-edit-field">
                      <span>Hinweis / Spalte notes (optional)</span>
                      <input
                        v-model="defDraft.notes"
                        type="text"
                        class="entry-edit-input"
                        placeholder="z.B. Etymologie, Konstruktion…"
                      />
                    </label>
                  </div>

                  <label class="entry-edit-field">
                    <span>Tags (; getrennt)</span>
                    <input
                      v-model="editTagsDraft"
                      type="text"
                      class="entry-edit-input"
                      placeholder="z.B. zahlen; a1"
                    />
                  </label>

                  <label class="entry-edit-field">
                    <span>Gutachter-Kommentar (optional, nur im Delta-Export)</span>
                    <input
                      v-model="editReviewerCommentDraft"
                      type="text"
                      class="entry-edit-input"
                      placeholder="Begründung oder Rückfrage an Redaktion…"
                    />
                  </label>

                  <div class="entry-edit-actions">
                    <button
                      type="button"
                      class="btn-outline-sm btn-no-mt"
                      @click="editingEntry = false"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      class="btn-primary-sm"
                      :disabled="!canSaveEntryEdit || savingEntryEdit"
                      @click="saveEntryEdit"
                    >
                      {{ savingEntryEdit ? 'Speichert…' : 'Änderungen speichern' }}
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <ul class="meanings-list">
                  <li v-for="(def, dIdx) in selectedEntry.definitions" :key="dIdx">
                    <strong>{{ def.meaning }}</strong>
                    <span v-if="def.notes" class="def-notes">({{ def.notes }})</span>
                  </li>
                </ul>

                <div v-if="selectedEntry.tags && selectedEntry.tags.length > 0" class="modal-tags">
                  <span v-for="tag in selectedEntry.tags" :key="tag" class="tag-pill-lg">
                    #{{ tag }}
                  </span>
                </div>

                <p v-if="!canEditCorpora" class="entry-readonly-note">
                  🔒 Stammdaten in der Server-Ansicht schreibgeschützt — für eigene Korrekturen bitte installierte PWA oder Desktop-App nutzen.
                </p>
              </template>
            </div>

            <div class="modal-user-note">
              <div class="modal-note-head">
                <h4>Persönliche Notiz:</h4>
                <span v-if="explorerNoteSaved" class="note-saved-badge">✓ Gespeichert</span>
              </div>
              <textarea
                v-model="explorerNoteDraft"
                rows="2"
                placeholder="Eigene Eselsbrücke, Beispielsatz oder Hinweis (wird beim TSV-Export in Spalte „notes“ ausgegeben)…"
                class="explorer-note-textarea"
              ></textarea>
              <div class="modal-note-actions">
                <button type="button" class="btn-outline-sm" @click="saveExplorerNote">
                  Notiz speichern
                </button>
              </div>
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
                      <InterlinearText
                        :text="row.sgNative"
                        :lang="iastLangMode"
                        :enabled="interlinearMode"
                      />
                      <span v-if="!interlinearMode" class="translit-inline">({{ row.sgTranslit }})</span>
                    </td>
                    <td class="script-deva">
                      <InterlinearText
                        :text="row.plNative"
                        :lang="iastLangMode"
                        :enabled="interlinearMode"
                      />
                      <span v-if="!interlinearMode" class="translit-inline">({{ row.plTranslit }})</span>
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
                <span class="script-deva stem-val">
                  <InterlinearText :text="verbParadigm.rootNative" :lang="iastLangMode" :enabled="interlinearMode" />
                </span>
                <span v-if="!interlinearMode" class="translit-inline">({{ verbParadigm.rootTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Habitual (Präsens):</span>
                <span class="script-deva stem-val">
                  <InterlinearText :text="verbParadigm.habitNative" :lang="iastLangMode" :enabled="interlinearMode" />
                </span>
                <span v-if="!interlinearMode" class="translit-inline">({{ verbParadigm.habitTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Perfektpartizip:</span>
                <span class="script-deva stem-val">
                  <InterlinearText :text="verbParadigm.perfNative" :lang="iastLangMode" :enabled="interlinearMode" />
                </span>
                <span v-if="!interlinearMode" class="translit-inline">({{ verbParadigm.perfTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Futur (3. Sg.):</span>
                <span class="script-deva stem-val">
                  <InterlinearText :text="verbParadigm.futNative" :lang="iastLangMode" :enabled="interlinearMode" />
                </span>
                <span v-if="!interlinearMode" class="translit-inline">({{ verbParadigm.futTranslit }})</span>
              </div>
              <div class="stem-card">
                <span class="stem-label">Imperativ (आप):</span>
                <span class="script-deva stem-val">
                  <InterlinearText :text="verbParadigm.impNative" :lang="iastLangMode" :enabled="interlinearMode" />
                </span>
                <span v-if="!interlinearMode" class="translit-inline">({{ verbParadigm.impTranslit }})</span>
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
          <button class="btn-outline" @click="closeEntryDetail">
            Schließen
          </button>
        </div>
      </div>
    </div>

    <!-- Online Dictionary Audit Popup Modal -->
    <div v-if="showAuditModal" class="detail-modal-backdrop" @click.self="closeAuditModal">
      <div class="detail-modal-box audit-modal">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>Online-Wörterbuchprüfung ({{ isHindi ? "Wiktionary hi" : "Cologne MW" }})</h3>
            <span class="modal-translit">
              {{ auditRunning ? `Prüft ${auditDone} / ${auditTotal} Einträge…` : `${auditTotal} Einträge geprüft` }}
            </span>
          </div>
          <button class="modal-close-btn" @click="closeAuditModal">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="auditRunning" class="audit-progress-box">
            <div class="audit-progress-bar">
              <div
                class="audit-progress-fill"
                :style="{ width: auditTotal ? `${Math.round((auditDone / auditTotal) * 100)}%` : '0%' }"
              ></div>
            </div>
            <p class="audit-progress-text">
              {{ auditDone }} von {{ auditTotal }} Einträgen gegen das Online-Wörterbuch geprüft…
            </p>
          </div>

          <div v-else>
            <div class="audit-summary-row">
              <span class="audit-stat">Geprüft: <strong>{{ auditTotal }}</strong></span>
              <span class="audit-stat">Befunde: <strong>{{ auditFindings.length }}</strong></span>
              <span class="audit-stat">Auto-Korrekturen: <strong>{{ fixableFindingsCount }}</strong></span>
            </div>

            <div v-if="auditApplyNotice" class="audit-notice">
              ✓ {{ auditApplyNotice }}
            </div>

            <div v-if="auditFindings.length === 0" class="audit-clean">
              ✓ Alle {{ auditTotal }} geprüften Einträge stimmen mit dem Online-Wörterbuch und den Umschriftregeln überein.
            </div>

            <div v-else class="audit-list">
              <div
                v-for="(item, idx) in auditFindings"
                :key="`${item.entryId}-${item.issueType}-${idx}`"
                class="audit-item"
              >
                <label class="audit-item-check">
                  <input
                    v-if="hasSuggestion(item)"
                    type="checkbox"
                    :value="findingKey(item)"
                    v-model="selectedFindingKeys"
                  />
                  <span v-else class="audit-warn-dot" title="Manuelle Prüfung erforderlich">⚠</span>
                </label>
                <div class="audit-item-body">
                  <div class="audit-item-head">
                    <strong class="deva-text">{{ item.lemmaNative }}</strong>
                    <span v-if="item.lemmaTranslit" class="audit-translit">({{ item.lemmaTranslit }})</span>
                    <a
                      :href="item.lookupUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="audit-ext-link"
                    >
                      {{ item.lookupLabel }}
                    </a>
                  </div>
                  <div class="audit-item-msg">{{ item.message }}</div>
                  <div v-if="hasSuggestion(item)" class="audit-diff">
                    Vorschlag:
                    <span v-if="item.suggestedTranslit">
                      Umschrift: <code>{{ item.lemmaTranslit || "–" }}</code> -> <code>{{ item.suggestedTranslit }}</code>
                    </span>
                    <span v-if="item.suggestedPos">
                      Wortart: <code>{{ item.currentPos || "–" }}</code> -> <code>{{ item.suggestedPos }}</code>
                    </span>
                    <span v-if="item.suggestedGender">
                      Genus: <code>{{ item.currentGender || "–" }}</code> -> <code>{{ item.suggestedGender }}</code>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="!canEditCorpora && fixableFindingsCount > 0" class="audit-readonly-hint">
              Hinweis: Im Browser/PWA-Modus sind Wortlisten schreibgeschützt. Für dauerhafte Korrekturen in SQLite bitte die Desktop-App nutzen (oder Liste als TSV exportieren).
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <template v-if="auditRunning">
            <button class="btn-outline" @click="cancelOnlineAudit">
              Abbrechen
            </button>
          </template>
          <template v-else>
            <button
              v-if="fixableFindingsCount > 0"
              class="btn-outline"
              @click="toggleAllFixable"
            >
              {{ selectedFindingKeys.length === fixableFindingsCount ? "Auswahl aufheben" : "Alle Vorschläge auswählen" }}
            </button>
            <button
              v-if="canEditCorpora && fixableFindingsCount > 0"
              class="btn-primary"
              :disabled="selectedFindingKeys.length === 0 || auditApplying"
              @click="applySelectedFixes"
            >
              {{ auditApplying ? "Speichert…" : `✓ Freigeben & Korrekturen anwenden (${selectedFindingKeys.length})` }}
            </button>
            <button class="btn-outline" @click="closeAuditModal">
              Schließen
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Review Delta Import & Selective Apply Modal -->
    <div v-if="showDeltaModal" class="detail-modal-backdrop" @click.self="showDeltaModal = false">
      <div class="detail-modal-box audit-modal">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>Korrektur-Delta prüfen ({{ deltaModalTitle || corpusTitle }})</h3>
            <span class="modal-translit">
              {{ incomingDeltaItems.length }} Eintrag/Einträge im Delta · {{ applicableDeltaCount }} anwendbar
            </span>
          </div>
          <button class="modal-close-btn" @click="showDeltaModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="deltaModalError" class="audit-notice">
            ⚠ {{ deltaModalError }}
          </div>
          <div v-if="deltaApplyNotice" class="audit-notice">
            ✓ {{ deltaApplyNotice }}
          </div>

          <div v-if="!deltaModalError && incomingDeltaItems.length === 0" class="audit-clean">
            Das Delta enthält keine ausstehenden Änderungen.
          </div>

          <div v-else-if="incomingDeltaItems.length > 0" class="audit-list">
            <div
              v-for="row in incomingDeltaItems"
              :key="row.id"
              class="audit-item"
            >
              <label class="audit-item-check">
                <input
                  type="checkbox"
                  :value="row.id"
                  v-model="selectedDeltaIds"
                  :disabled="!row.applicable"
                />
              </label>
              <div class="audit-item-body">
                <div class="audit-item-head">
                  <strong class="deva-text">{{ row.after.lemma_native }}</strong>
                  <span v-if="row.after.lemma_translit" class="audit-translit">({{ row.after.lemma_translit }})</span>
                  <span class="audit-translit">ID: {{ row.id }}</span>
                </div>
                <div v-if="!row.applicable" class="audit-item-msg">
                  (bereits identisch im aktuellen Korpus)
                </div>
                <div v-for="(diff, dIdx) in row.diffs" :key="dIdx" class="audit-diff">
                  {{ diff }}
                </div>
                <div v-if="row.reviewer_comment" class="audit-item-msg">
                  💬 Gutachter-Kommentar: „{{ row.reviewer_comment }}“
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            v-if="applicableDeltaCount > 0"
            type="button"
            class="btn-outline"
            @click="toggleAllApplicableDeltas"
          >
            {{ selectedDeltaIds.length === applicableDeltaCount ? "Auswahl aufheben" : "Alle auswählen" }}
          </button>
          <button
            v-if="applicableDeltaCount > 0"
            type="button"
            class="btn-primary"
            :disabled="selectedDeltaIds.length === 0 || deltaApplying"
            @click="applySelectedDeltas"
          >
            {{ deltaApplying ? "Speichert…" : `✓ Freigeben & Korrekturen anwenden (${selectedDeltaIds.length})` }}
          </button>
          <button type="button" class="btn-outline" @click="showDeltaModal = false">
            Schließen
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { type AuditFinding, auditEntriesOnline } from "../services/corpusAudit";
import {
  type HindiNounDeclension,
  type HindiVerbParadigm,
  getHindiNounDeclension,
  getHindiVerbParadigm,
} from "../services/hindiMorphology";
import { speechService } from "../services/speech";
import {
  type EntryPatch,
  type EntrySnapshot,
  type ReviewDeltaDocument,
  type ReviewDeltaItem,
  downloadTSV,
  formatCombinedNotes,
  sanitizeTsvField,
  snapshotsEqual,
  storage,
  toEntrySnapshot,
} from "../services/storage";
import {
  hkToDevanagariSync,
  hkToIast,
  iastToDevanagariSync,
  toggleTransliteration,
} from "../services/transliteration";
import type { LessonData, StudyCardItem, VolumeData } from "../types";
import InterlinearText from "./InterlinearText.vue";

const props = defineProps<{
  corpusId: string;
  corpusTitle: string;
  isHindi: boolean;
  canEditCorpora?: boolean;
  isReviewMode?: boolean;
  volumesList: VolumeData[];
  lessonsList: LessonData[];
  selectedVolumeIds: string[];
  selectedLessonIds: string[];
}>();

const emit = defineEmits<{
  (e: "practice-selection", items: StudyCardItem[]): void;
  (e: "switch-tab", tab: string): void;
  (e: "entries-updated"): void;
  (e: "open-install-info"): void;
}>();

// State
const loading = ref(false);
const allEntries = ref<StudyCardItem[]>([]);
const selectedEntry = ref<StudyCardItem | null>(null);
const editingEntry = ref(false);
const savingEntryEdit = ref(false);
const entryEditSaved = ref(false);
let entryEditSavedTimer: ReturnType<typeof setTimeout> | null = null;
const editNativeDraft = ref("");
const editTranslitDraft = ref("");
const editPosDraft = ref("");
const editGenderDraft = ref("");
const editDefinitionsDraft = ref<
  Array<{ lang: string; meaning: string; notes: string }>
>([]);
const editTagsDraft = ref("");
const editReviewerCommentDraft = ref("");
const pendingDeltaItems = ref<ReviewDeltaItem[]>([]);
const showDeltaModal = ref(false);
const deltaModalTitle = ref("");
const deltaModalError = ref("");
const deltaApplyNotice = ref("");
const deltaApplying = ref(false);
const incomingDeltaItems = ref<
  Array<ReviewDeltaItem & { diffs: string[]; applicable: boolean }>
>([]);
const selectedDeltaIds = ref<string[]>([]);
const explorerNoteDraft = ref("");
const explorerNoteSaved = ref(false);
let explorerNoteSavedTimer: ReturnType<typeof setTimeout> | null = null;

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

const INTERLINEAR_STORAGE_KEY = "alexis.explorer.interlinearIast";
function loadInterlinearPref(): boolean {
  try {
    return localStorage.getItem(INTERLINEAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
const interlinearMode = ref(loadInterlinearPref());
watch(interlinearMode, (val) => {
  try {
    localStorage.setItem(INTERLINEAR_STORAGE_KEY, val ? "1" : "0");
  } catch {
    // ignore storage quota / privacy mode errors
  }
});
const iastLangMode = computed<"hi" | "sa">(() => (props.isHindi ? "hi" : "sa"));

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
    await refreshPendingDelta();
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.corpusId,
  () => {
    closeEntryDetail();
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
    const qDevaHk = hkToDevanagariSync(qRaw);
    const qDevaIast = iastToDevanagariSync(qRaw);
    const qIast = hkToIast(qRaw).toLowerCase();

    list = list.filter((e) => {
      if (
        e.lemma_native.toLowerCase().includes(q) ||
        (qDevaHk && e.lemma_native.includes(qDevaHk)) ||
        (qDevaIast && e.lemma_native.includes(qDevaIast))
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
        e.definitions.some((d) => (d.notes || "").toLowerCase().includes(q)) ||
        (e.user_note || "").toLowerCase().includes(q)
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

// Online Dictionary Audit & Approval Flow
const showAuditModal = ref(false);
const auditRunning = ref(false);
const auditApplying = ref(false);
const auditDone = ref(0);
const auditTotal = ref(0);
const auditFindings = ref<AuditFinding[]>([]);
const selectedFindingKeys = ref<string[]>([]);
const auditApplyNotice = ref("");
let auditAbortController: AbortController | null = null;

function findingKey(item: AuditFinding): string {
  return `${item.entryId}::${item.issueType}`;
}

function hasSuggestion(item: AuditFinding): boolean {
  return Boolean(
    item.suggestedTranslit || item.suggestedPos || item.suggestedGender,
  );
}

const fixableFindingsCount = computed(() => {
  return auditFindings.value.filter(hasSuggestion).length;
});

async function runOnlineAudit() {
  if (!props.canEditCorpora) return;
  const targets = filteredEntries.value;
  if (targets.length === 0 || auditRunning.value) return;

  auditAbortController?.abort();
  auditAbortController = new AbortController();

  showAuditModal.value = true;
  auditRunning.value = true;
  auditDone.value = 0;
  auditTotal.value = targets.length;
  auditFindings.value = [];
  selectedFindingKeys.value = [];
  auditApplyNotice.value = "";

  try {
    const findings = await auditEntriesOnline(targets, props.isHindi, {
      signal: auditAbortController.signal,
      onProgress: (done, total) => {
        auditDone.value = done;
        auditTotal.value = total;
      },
    });
    auditFindings.value = findings;
    selectedFindingKeys.value = findings.filter(hasSuggestion).map(findingKey);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("Online audit failed:", err);
    }
  } finally {
    auditRunning.value = false;
    auditAbortController = null;
  }
}

function cancelOnlineAudit() {
  auditAbortController?.abort();
  auditRunning.value = false;
}

onUnmounted(() => {
  cancelOnlineAudit();
  if (entryEditSavedTimer) clearTimeout(entryEditSavedTimer);
  if (explorerNoteSavedTimer) clearTimeout(explorerNoteSavedTimer);
});

function closeAuditModal() {
  cancelOnlineAudit();
  showAuditModal.value = false;
}

function toggleAllFixable() {
  const fixable = auditFindings.value.filter(hasSuggestion).map(findingKey);
  if (selectedFindingKeys.value.length === fixable.length) {
    selectedFindingKeys.value = [];
  } else {
    selectedFindingKeys.value = fixable;
  }
}

async function applySelectedFixes() {
  if (!props.canEditCorpora || auditApplying.value) return;
  const selectedSet = new Set(selectedFindingKeys.value);
  const selectedFindings = auditFindings.value.filter((item) =>
    selectedSet.has(findingKey(item)),
  );
  if (selectedFindings.length === 0) return;

  auditApplying.value = true;
  try {
    const entryMap = new Map(allEntries.value.map((e) => [e.entry_id, e]));
    const patchMap = new Map<string, EntryPatch>();

    for (const item of selectedFindings) {
      const base = entryMap.get(item.entryId);
      if (!base) continue;
      const existing = patchMap.get(item.entryId) ?? {
        id: base.entry_id,
        lemma_native: base.lemma_native,
        lemma_translit: base.lemma_translit,
        pos: base.pos ?? null,
        gender: base.gender ?? null,
      };
      if (item.suggestedTranslit) {
        existing.lemma_translit = item.suggestedTranslit;
      }
      if (item.suggestedPos) {
        existing.pos = item.suggestedPos;
      }
      if (item.suggestedGender) {
        existing.gender = item.suggestedGender;
      }
      patchMap.set(item.entryId, existing);
    }

    const patches = Array.from(patchMap.values());
    const count = await storage.updateEntries(props.corpusId, patches);

    for (const patch of patches) {
      const target = entryMap.get(patch.id);
      if (target) {
        target.lemma_native = patch.lemma_native;
        target.lemma_translit = patch.lemma_translit;
        target.pos = patch.pos ?? undefined;
        target.gender = patch.gender ?? undefined;
      }
    }

    auditFindings.value = auditFindings.value.filter(
      (item) => !selectedSet.has(findingKey(item)),
    );
    selectedFindingKeys.value = [];
    auditApplyNotice.value = `${count} Korrektur(en) gespeichert.`;
    await refreshPendingDelta();
    emit("entries-updated");
  } finally {
    auditApplying.value = false;
  }
}

async function refreshPendingDelta() {
  if (!props.canEditCorpora) {
    pendingDeltaItems.value = [];
    return;
  }
  const doc = await storage.getReviewDelta(props.corpusId, allEntries.value);
  pendingDeltaItems.value = doc.changes;
}

async function downloadReviewDelta() {
  const doc = await storage.getReviewDelta(props.corpusId, allEntries.value);
  pendingDeltaItems.value = doc.changes;
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.corpusId}_review_delta_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function discardStagedOverrides() {
  await storage.resetCorpusOverrides(props.corpusId);
  closeEntryDetail();
  await loadEntries();
  emit("entries-updated");
}

function formatDefsForDiff(
  defs: Array<{ meaning: string; notes?: string }>,
): string {
  return defs
    .map((d) => (d.notes ? `${d.meaning} [${d.notes}]` : d.meaning))
    .join(" · ");
}

function computeSnapshotDiffLines(
  cur: EntrySnapshot,
  next: EntrySnapshot,
): string[] {
  const lines: string[] = [];
  if (cur.lemma_native !== next.lemma_native) {
    lines.push(`Devanāgarī: ${cur.lemma_native} -> ${next.lemma_native}`);
  }
  if (cur.lemma_translit !== next.lemma_translit) {
    lines.push(
      `Umschrift: ${cur.lemma_translit || "–"} -> ${next.lemma_translit || "–"}`,
    );
  }
  if ((cur.pos || "") !== (next.pos || "")) {
    lines.push(`Wortart: ${cur.pos || "–"} -> ${next.pos || "–"}`);
  }
  if ((cur.gender || "") !== (next.gender || "")) {
    lines.push(`Genus: ${cur.gender || "–"} -> ${next.gender || "–"}`);
  }
  const curDefs = formatDefsForDiff(cur.definitions);
  const nextDefs = formatDefsForDiff(next.definitions);
  if (curDefs !== nextDefs) {
    lines.push(`Bedeutung/Notiz: ${curDefs || "–"} -> ${nextDefs || "–"}`);
  }
  const curTags = cur.tags.join(";");
  const nextTags = next.tags.join(";");
  if (curTags !== nextTags) {
    lines.push(`Tags: ${curTags || "–"} -> ${nextTags || "–"}`);
  }
  return lines;
}

const applicableDeltaCount = computed(() => {
  return incomingDeltaItems.value.filter((item) => item.applicable).length;
});

async function handleDeltaFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  deltaModalError.value = "";
  deltaApplyNotice.value = "";
  incomingDeltaItems.value = [];
  selectedDeltaIds.value = [];
  deltaModalTitle.value = props.corpusTitle;

  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as Partial<ReviewDeltaDocument>;
    if (
      parsed?.schema !== "alexis-review-delta-v1" ||
      !Array.isArray(parsed.changes)
    ) {
      deltaModalError.value =
        "Ungültiges Dateiformat (erwartet Schema „alexis-review-delta-v1“).";
      showDeltaModal.value = true;
      return;
    }
    if (parsed.corpus_id && parsed.corpus_id !== props.corpusId) {
      deltaModalError.value = `Dieses Delta gehört zum Korpus „${parsed.corpus_id}“ (aktiv ist „${props.corpusId}“). Bitte zuerst den passenden Korpus wählen.`;
      showDeltaModal.value = true;
      return;
    }
    deltaModalTitle.value = parsed.corpus_title || props.corpusTitle;

    const entryMap = new Map(
      allEntries.value.map((item) => [item.entry_id, item]),
    );
    const bundleEntries = new Map(
      (storage.getCorpusBundle(props.corpusId)?.entries ?? []).map((item) => [
        item.id,
        item,
      ]),
    );

    const rows = parsed.changes.map((change) => {
      const currentItem =
        entryMap.get(change.id) ?? bundleEntries.get(change.id);
      const currentSnapshot = currentItem
        ? toEntrySnapshot(currentItem)
        : change.before;
      const diffs = computeSnapshotDiffLines(currentSnapshot, change.after);
      return {
        ...change,
        diffs,
        applicable: diffs.length > 0,
      };
    });

    incomingDeltaItems.value = rows;
    selectedDeltaIds.value = rows.filter((r) => r.applicable).map((r) => r.id);
    showDeltaModal.value = true;
  } catch (err) {
    deltaModalError.value = `Delta konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`;
    showDeltaModal.value = true;
  } finally {
    target.value = "";
  }
}

function toggleAllApplicableDeltas() {
  const applicableIds = incomingDeltaItems.value
    .filter((item) => item.applicable)
    .map((item) => item.id);
  if (selectedDeltaIds.value.length === applicableIds.length) {
    selectedDeltaIds.value = [];
  } else {
    selectedDeltaIds.value = applicableIds;
  }
}

async function applySelectedDeltas() {
  if (!props.canEditCorpora || deltaApplying.value) return;
  const selectedSet = new Set(selectedDeltaIds.value);
  const chosen = incomingDeltaItems.value.filter(
    (item) => item.applicable && selectedSet.has(item.id),
  );
  if (chosen.length === 0) return;

  deltaApplying.value = true;
  try {
    const patches: EntryPatch[] = chosen.map((item) => ({
      id: item.id,
      lemma_native: item.after.lemma_native,
      lemma_translit: item.after.lemma_translit,
      pos: item.after.pos ?? null,
      gender: item.after.gender ?? null,
      definitions: item.after.definitions.map((d) => ({ ...d })),
      tags: [...item.after.tags],
    }));

    const count = await storage.updateEntries(props.corpusId, patches);
    const entryMap = new Map(allEntries.value.map((e) => [e.entry_id, e]));
    for (const patch of patches) {
      const target = entryMap.get(patch.id);
      if (target) {
        target.lemma_native = patch.lemma_native;
        target.lemma_translit = patch.lemma_translit;
        target.pos = patch.pos ?? undefined;
        target.gender = patch.gender ?? undefined;
        target.definitions = (patch.definitions ?? []).map((d) => ({ ...d }));
        target.tags = [...(patch.tags ?? [])];
      }
    }

    for (const row of incomingDeltaItems.value) {
      if (selectedSet.has(row.id)) {
        row.applicable = false;
        row.diffs = [];
      }
    }
    selectedDeltaIds.value = [];
    deltaApplyNotice.value = `${count} Delta-Korrektur(en) übernommen.`;
    await refreshPendingDelta();
    emit("entries-updated");
  } finally {
    deltaApplying.value = false;
  }
}

// Format helpers
function formatPosShort(pos?: string | null): string {
  if (!pos) return "";
  const p = pos.toLowerCase();
  if (p.includes("noun") || p.includes("subst")) return "Subst.";
  if (p.includes("verb")) return "Verb";
  if (p.includes("adj")) return "Adj.";
  if (p.includes("adv")) return "Adv.";
  if (p.includes("pron")) return "Pron.";
  if (p.includes("num")) return "Num.";
  if (p.includes("interj")) return "Interj.";
  if (p.includes("conj") || p.includes("konj")) return "Konj.";
  if (p.includes("part") || p.includes("ptk")) return "Part.";
  if (p.includes("postp")) return "Postp.";
  if (p.includes("ind")) return "Indekl.";
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
  if (p.includes("num")) return "Zahlwort";
  if (p.includes("interj")) return "Interjektion";
  if (p.includes("conj") || p.includes("konj")) return "Konjunktion";
  if (p.includes("part") || p.includes("ptk")) return "Partikel";
  if (p.includes("postp")) return "Postposition";
  if (p.includes("ind")) return "Indeklinabile";
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
function closeEntryDetail() {
  selectedEntry.value = null;
  editingEntry.value = false;
  entryEditSaved.value = false;
}

function toggleEntryDetail(item: StudyCardItem) {
  if (selectedEntry.value?.entry_id === item.entry_id) {
    closeEntryDetail();
  } else {
    selectedEntry.value = item;
    editingEntry.value = false;
    entryEditSaved.value = false;
    explorerNoteDraft.value = item.user_note || "";
    explorerNoteSaved.value = false;
  }
}

function startEntryEdit() {
  if (!props.canEditCorpora || !selectedEntry.value) return;
  const item = selectedEntry.value;
  editNativeDraft.value = item.lemma_native;
  editTranslitDraft.value = item.lemma_translit;
  editPosDraft.value = item.pos || "";
  editGenderDraft.value = item.gender && item.gender !== "-" ? item.gender : "";
  editDefinitionsDraft.value =
    item.definitions.length > 0
      ? item.definitions.map((d) => ({
          lang: d.lang || "de",
          meaning: d.meaning,
          notes: d.notes || "",
        }))
      : [{ lang: "de", meaning: "", notes: "" }];
  editTagsDraft.value = (item.tags || []).join("; ");
  editReviewerCommentDraft.value =
    storage.getEntryOverride(item.entry_id)?.reviewer_comment || "";
  entryEditSaved.value = false;
  editingEntry.value = true;
}

const canSaveEntryEdit = computed(() => {
  return (
    Boolean(editNativeDraft.value.trim()) &&
    editDefinitionsDraft.value.some((d) => d.meaning.trim().length > 0)
  );
});

async function saveEntryEdit() {
  if (
    !props.canEditCorpora ||
    !selectedEntry.value ||
    !canSaveEntryEdit.value ||
    savingEntryEdit.value
  ) {
    return;
  }
  savingEntryEdit.value = true;
  try {
    const cleanedDefs = editDefinitionsDraft.value
      .map((d) => ({
        lang: d.lang || "de",
        meaning: d.meaning.trim(),
        ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
      }))
      .filter((d) => d.meaning.length > 0);
    const cleanedTags = editTagsDraft.value
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const cleanGender = editGenderDraft.value.trim();
    const cleanComment = editReviewerCommentDraft.value.trim();
    const patch: EntryPatch = {
      id: selectedEntry.value.entry_id,
      lemma_native: editNativeDraft.value.trim(),
      lemma_translit: editTranslitDraft.value.trim(),
      pos: editPosDraft.value.trim() || null,
      gender: cleanGender && cleanGender !== "-" ? cleanGender : null,
      definitions: cleanedDefs,
      tags: cleanedTags,
      ...(props.isReviewMode
        ? { reviewer_comment: cleanComment }
        : cleanComment
          ? { reviewer_comment: cleanComment }
          : {}),
    };

    await storage.updateEntries(props.corpusId, [patch]);

    selectedEntry.value.lemma_native = patch.lemma_native;
    selectedEntry.value.lemma_translit = patch.lemma_translit;
    selectedEntry.value.pos = patch.pos ?? undefined;
    selectedEntry.value.gender = patch.gender ?? undefined;
    selectedEntry.value.definitions = cleanedDefs.map((d) => ({ ...d }));
    selectedEntry.value.tags = [...cleanedTags];

    const target = allEntries.value.find(
      (e) => e.entry_id === selectedEntry.value?.entry_id,
    );
    if (target) {
      target.lemma_native = patch.lemma_native;
      target.lemma_translit = patch.lemma_translit;
      target.pos = patch.pos ?? undefined;
      target.gender = patch.gender ?? undefined;
      target.definitions = cleanedDefs.map((d) => ({ ...d }));
      target.tags = [...cleanedTags];
    }

    editingEntry.value = false;
    entryEditSaved.value = true;
    if (entryEditSavedTimer) clearTimeout(entryEditSavedTimer);
    entryEditSavedTimer = setTimeout(() => {
      entryEditSaved.value = false;
    }, 2000);
    await refreshPendingDelta();
    emit("entries-updated");
  } finally {
    savingEntryEdit.value = false;
  }
}

async function saveExplorerNote() {
  if (!selectedEntry.value) return;
  const saved = await storage.saveUserNote(
    selectedEntry.value.entry_id,
    explorerNoteDraft.value,
  );
  selectedEntry.value.user_note = saved;
  const target = allEntries.value.find(
    (e) => e.entry_id === selectedEntry.value?.entry_id,
  );
  if (target) {
    target.user_note = saved;
  }
  explorerNoteSaved.value = true;
  if (explorerNoteSavedTimer) clearTimeout(explorerNoteSavedTimer);
  explorerNoteSavedTimer = setTimeout(() => {
    explorerNoteSaved.value = false;
  }, 2000);
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

function buildFilteredTsvRows(includeCurriculumLabels: boolean): string {
  const header = includeCurriculumLabels
    ? "Devanagari\tIAST\tWortart\tGenus\tBedeutung\tGliederung\tBox\tNotizen"
    : "volume\tlesson\tnative\ttransliteration\tpos\tgender\tmeaning_de\ttags\tnotes";
  const rows = filteredEntries.value.map((e) => {
    const meanings = sanitizeTsvField(formatMeanings(e));
    const notes = formatCombinedNotes(e.definitions, e.user_note);
    if (includeCurriculumLabels) {
      return [
        sanitizeTsvField(e.lemma_native),
        sanitizeTsvField(e.lemma_translit),
        sanitizeTsvField(e.pos || ""),
        sanitizeTsvField(e.gender || ""),
        meanings,
        sanitizeTsvField(formatLessonLabel(e)),
        `Box ${e.box_number}`,
        notes,
      ].join("\t");
    }
    const tags = (e.tags || [])
      .map((t) => sanitizeTsvField(t))
      .filter(Boolean)
      .join(";");
    return [
      sanitizeTsvField(e.volume_id),
      sanitizeTsvField(e.lesson_id ? e.lesson_id.replace(/^.*_l0?/, "") : "1"),
      sanitizeTsvField(e.lemma_native),
      sanitizeTsvField(e.lemma_translit),
      sanitizeTsvField(e.pos || ""),
      sanitizeTsvField(e.gender || "-"),
      meanings,
      tags,
      notes,
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}

// Download Filtered as TSV
function downloadFilteredTSV() {
  if (filteredEntries.value.length === 0) return;
  const tsvText = buildFilteredTsvRows(false);
  const filename = `${props.corpusId}_export_${filteredEntries.value.length}_vokabeln.tsv`;
  downloadTSV(tsvText, filename);
}

// Copy as TSV
async function copyAsTSV() {
  const tsvText = buildFilteredTsvRows(true);
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

.readonly-mode-hint {
  margin-top: 0.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.86rem;
  line-height: 1.45;
}

.btn-inline-link {
  color: var(--accent-gold);
  font-weight: 600;
  text-decoration: underline;
  padding: 0;
  margin: 0;
  font-size: inherit;
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
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--accent-gold);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition: all 0.15s ease;
}

.btn-table-speak .speaker-icon {
  width: 14px;
  height: 14px;
}

.btn-table-speak:hover {
  opacity: 1;
  background: var(--accent-gold);
  color: #ffffff;
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

.btn-outline-sm.btn-no-mt {
  margin-top: 0;
}

.btn-primary-sm {
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  background: var(--accent-gold);
  color: #ffffff;
  border: 1px solid var(--accent-gold);
}

.btn-primary-sm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
  color: var(--accent-gold);
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-modal-speak .speaker-icon {
  width: 18px;
  height: 18px;
}

.btn-modal-speak:hover {
  background: var(--accent-gold);
  color: #ffffff;
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

.modal-meanings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.modal-meanings-head h4 {
  font-size: 1rem;
  margin: 0;
  color: var(--text-muted);
}

.entry-readonly-note {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.entry-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.entry-edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.65rem;
}

.entry-edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.entry-edit-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.9rem;
}

.entry-edit-input:focus {
  outline: none;
  border-color: var(--accent-gold);
}

.entry-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
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

.note-pill {
  display: inline-block;
  font-size: 0.72rem;
  color: var(--accent-gold);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
}

.modal-user-note {
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.modal-note-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.modal-note-head h4 {
  font-size: 0.92rem;
  margin: 0;
  color: var(--text-muted);
}

.note-saved-badge {
  font-size: 0.8rem;
  color: #16a34a;
  font-weight: 600;
}

.explorer-note-textarea {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.45;
  resize: vertical;
}

.explorer-note-textarea:focus {
  outline: none;
  border-color: var(--accent-gold);
}

.modal-note-actions {
  margin-top: 0.45rem;
  display: flex;
  justify-content: flex-end;
}

.modal-note-actions .btn-outline-sm {
  margin-top: 0;
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

.interlinear-active .col-native,
.interlinear-active .modal-native,
.interlinear-active .paradigm-table td.script-deva,
.interlinear-active .stem-val {
  line-height: 2.35;
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

/* Audit Modal */
.audit-modal {
  max-width: 720px;
}

.audit-progress-box {
  padding: 1.25rem 0;
}

.audit-progress-bar {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--bg-surface);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.audit-progress-fill {
  height: 100%;
  background: var(--accent-gold);
  transition: width 0.2s ease;
}

.audit-progress-text {
  margin-top: 0.65rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.audit-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.audit-notice {
  padding: 0.6rem 0.85rem;
  margin-bottom: 0.9rem;
  border-radius: 6px;
  border: 1px solid var(--accent-gold);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.audit-clean {
  padding: 1rem;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 52vh;
  overflow-y: auto;
}

.audit-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.audit-item-check {
  padding-top: 0.15rem;
}

.audit-warn-dot {
  color: var(--accent-gold);
  font-weight: 700;
}

.audit-item-body {
  flex: 1;
  min-width: 0;
}

.audit-item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.45rem;
}

.audit-translit {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.audit-ext-link {
  margin-left: auto;
  font-size: 0.82rem;
  color: var(--accent-gold);
  text-decoration: none;
}

.audit-item-msg {
  font-size: 0.88rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

.audit-diff {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.audit-readonly-hint {
  margin-top: 0.85rem;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.upload-delta-label {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.reviewer-banner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  border: 1px solid var(--accent-gold);
  background: var(--bg-surface);
  font-size: 0.9rem;
}

.reviewer-banner-text {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  color: var(--text-primary);
}

.reviewer-banner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
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
