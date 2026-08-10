<script setup lang="ts">
import { computed, ref } from "vue";
import type { CollectionField } from "@/config";
import { domainOf, permalinkFor } from "@/lib/repoconfig";
import FrontmatterForm from "./FrontmatterForm.vue";

const props = defineProps<{
  fields: CollectionField[];
  modelValue: Record<string, unknown>;
  slug: string;
  urlTemplate: string;
}>();

const emit = defineEmits<(e: "update:modelValue", value: Record<string, unknown>) => void>();

const open = ref(false);

const title = computed(() => String(props.modelValue.title ?? "") || "Untitled");
const isDraft = computed(() => props.modelValue.draft === true);
const categories = computed(() =>
  Array.isArray(props.modelValue.categories) ? (props.modelValue.categories as string[]) : [],
);
const permalink = computed(() => permalinkFor(props.urlTemplate, props.slug));
const domain = computed(() => domainOf(permalink.value));
const description = computed(() => String(props.modelValue.description ?? ""));
const pubDate = computed(() => {
  const raw = String(props.modelValue.pubDatetime ?? "");
  const d = new Date(raw);
  return raw && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";
});
</script>

<template>
  <div class="panel">
    <button class="summary" :aria-expanded="open" @click="open = !open">
      <span class="summary-text">
        <span class="summary-title">{{ title }}</span>
        <span class="summary-chips">
          <span v-if="pubDate" class="chip">{{ pubDate }}</span>
          <span v-if="isDraft" class="chip">draft</span>
          <span v-for="c in categories" :key="c" class="chip">{{ c }}</span>
        </span>
      </span>
      <span class="toggle-row">
        <span class="muted small">{{ open ? "Hide metadata" : "Metadata" }}</span>
        <svg class="icon chevron" :class="{ flipped: open }" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.646 5.646a.5.5 0 0 1 .708 0L8 9.293l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708z" />
        </svg>
      </span>
    </button>

    <div v-show="open" class="details">
      <div class="form-col">
        <FrontmatterForm :fields="fields" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
      </div>

      <div class="preview-col">
        <template v-if="permalink">
          <p class="muted small">Permalink</p>
          <a class="permalink" :href="permalink" target="_blank" rel="noreferrer">{{ permalink }}</a>
          <div class="og-card">
            <p class="og-title">{{ title }}</p>
            <p class="og-desc" :class="{ muted: !description }">{{ description || "No description yet." }}</p>
            <p class="og-site muted small">{{ domain }}</p>
          </div>
        </template>
        <p v-else class="muted small">Set a preview URL template in the repo settings to see the permalink here.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: transparent;
  border: 1.5px solid var(--ink);
  border-radius: var(--radius-sm);
}

.summary {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.8rem 1.15rem;
  text-align: left;
}

.summary:active:not(:disabled) {
  transform: none;
}

.summary-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.summary-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.chevron {
  color: var(--ink-muted);
  transition: transform 0.15s ease;
}

.chevron.flipped {
  transform: rotate(180deg);
}

.details {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1.25rem;
  padding: 0 1.15rem 1.15rem;
}

.permalink {
  word-break: break-all;
  font-size: 0.9rem;
}

.og-card {
  margin-top: 0.75rem;
  background: transparent;
  border: 1.5px solid var(--separator);
  border-radius: var(--radius-sm);
  padding: 1rem;
}

.og-title {
  margin: 0 0 0.3rem;
  font-weight: 700;
  line-height: 1.3;
}

.og-desc {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.og-site {
  margin: 0;
  text-transform: lowercase;
}

@media (max-width: 880px) {
  .details {
    grid-template-columns: 1fr;
  }
}
</style>
