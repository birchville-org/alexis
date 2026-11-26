<template>
  <div class="backup-meccano-wrap">
    <div class="backup-meccano-card">
      <div class="backup-meccano-head">
        <div>
          <strong>{{ title }}</strong>
          <p class="backup-meccano-meta">
            Letztes Backup:
            <template v-if="summary">
              <strong>{{ summary.dateLabel }}</strong> ·
              <code>{{ summary.filename }}</code> ({{ summary.countsLabel }})
            </template>
            <span v-else>Noch kein Backup auf diesem Gerät ausgelöst.</span>
          </p>
        </div>
        <span :class="['backup-age-pill', ageToneClass]">
          {{ ageBadgeText }}
        </span>
      </div>

      <div v-if="!actionsGrid" class="backup-meccano-actions">
        <button
          type="button"
          class="btn-outline download-btn"
          @click="$emit('backup')"
        >
          💾 Jetzt Backup sichern (.json)
        </button>
        <label class="btn-outline download-btn">
          <input
            type="file"
            accept=".json,application/json"
            style="display:none"
            @change="$emit('restore', $event)"
          />
          📂 Backup einspielen (.json)
        </label>
        <slot name="extra-actions" />
      </div>

      <p v-if="notice" class="backup-status-msg ok">✓ {{ notice }}</p>
      <p v-if="error" class="backup-status-msg err">⚠ {{ error }}</p>
    </div>

    <div v-if="actionsGrid" class="download-actions-grid">
      <button
        type="button"
        class="btn-outline download-btn"
        @click="$emit('backup')"
      >
        💾 Jetzt Backup sichern (.json)
      </button>
      <label class="btn-outline download-btn">
        <input
          type="file"
          accept=".json,application/json"
          style="display:none"
          @change="$emit('restore', $event)"
        />
        📂 Backup einspielen (.json)
      </label>
      <slot name="extra-actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface BackupSummaryView {
  dateLabel: string;
  filename: string;
  countsLabel: string;
  daysAgo: number;
  isStale: boolean;
}

const props = withDefaults(
  defineProps<{
    summary: BackupSummaryView | null;
    notice?: string;
    error?: string;
    title?: string;
    actionsGrid?: boolean;
  }>(),
  {
    notice: "",
    error: "",
    title: "🛡️ Lokales JSON-Backup (Lernstand, Notizen & lokale Anpassungen)",
    actionsGrid: false,
  },
);

defineEmits<{
  backup: [];
  restore: [event: Event];
}>();

const ageBadgeText = computed(() => {
  if (!props.summary) return "Kein Backup";
  if (props.summary.daysAgo === 0) return "Heute gesichert";
  if (props.summary.daysAgo === 1) return "Vor 1 Tag";
  return `Vor ${props.summary.daysAgo} Tagen`;
});

const ageToneClass = computed(() => {
  if (!props.summary) return "none";
  return props.summary.isStale ? "stale" : "ok";
});
</script>

<style scoped>
.backup-meccano-card {
  margin-top: 1rem;
  padding: 0.95rem 1.1rem;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.backup-meccano-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.backup-meccano-meta {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.backup-age-pill {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid var(--border-subtle);
}

.backup-age-pill.ok {
  background: rgba(16, 185, 129, 0.14);
  color: #047857;
  border-color: rgba(16, 185, 129, 0.35);
}

.backup-age-pill.stale {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.4);
}

.backup-age-pill.none {
  background: var(--bg-surface-elevated);
  color: var(--text-muted);
}

.backup-meccano-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.download-actions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.65rem;
}

.btn-outline {
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 6px;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-sizing: border-box;
  margin: 0;
  padding: 0.7rem 1rem;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.3;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  background-color: var(--bg-surface);
}

.backup-meccano-actions .download-btn {
  padding: 0.55rem 0.9rem;
  font-size: 0.88rem;
}

.download-btn:hover {
  border-color: var(--accent-gold);
}

.backup-status-msg {
  margin: 0;
  font-size: 0.84rem;
}

.backup-status-msg.ok {
  color: #047857;
}

.backup-status-msg.err {
  color: #b91c1c;
}
</style>
