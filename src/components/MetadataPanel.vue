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
      <span class="summary-title">{{ title }}</span>
      <span v-if="pubDate" class="chip">{{ pubDate }}</span>
      <span v-if="isDraft" class="chip">Draft</span>
      <span v-for="c in categories" :key="c" class="chip">{{ c }}</span>
      <span class="gap" />
      <span class="toggle">
        {{ open ? "Hide details" : "Details" }}
        <svg class="icon caret" :class="{ flipped: open }" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.22 6.28a.75.75 0 0 1 1.06-.06L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1z" />
        </svg>
      </span>
    </button>

    <div v-show="open" class="details">
      <FrontmatterForm
        class="form-col"
        :fields="fields"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <div class="preview-col">
        <template v-if="permalink">
          <p class="label">Permalink</p>
          <a class="permalink mono" :href="permalink" target="_blank" rel="noreferrer">{{ permalink }}</a>
          <div class="og-card">
            <p class="og-title">{{ title }}</p>
            <p class="og-desc" :class="{ muted: !description }">
              {{ description || "No description yet." }}
            </p>
            <p class="og-site">{{ domain }}</p>
          </div>
        </template>
        <p v-else class="hint">
          Set a preview URL in repo settings to see the permalink and link preview here.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: var(--paper);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-low);
  margin-bottom: 1rem;
}

.summary {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  box-shadow: none;
  padding: 0.85rem 1.1rem;
  text-align: left;
  font-size: 0.9375rem;
  font-weight: 400;
}

.summary:hover:not(:disabled) {
  background: transparent;
  box-shadow: none;
}

.summary:hover .toggle {
  color: var(--ink);
}

.summary-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 46ch;
}

.gap {
  flex: 1;
  min-width: 0.5rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
  transition: color var(--fast) var(--ease);
}

.caret {
  transition: transform var(--fast) var(--ease);
}

.caret.flipped {
  transform: rotate(180deg);
}

.details {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 2.5rem;
  padding: 0.35rem 1.1rem 1.4rem;
}

.permalink {
  display: inline-block;
  margin: 0.2rem 0 1rem;
  word-break: break-all;
  color: var(--accent);
}

.og-card {
  background: var(--raised);
  border: 1px solid var(--separator);
  border-radius: var(--radius-md);
  padding: 0.9rem;
}

.og-title {
  margin: 0 0 0.3rem;
  font-weight: 500;
  line-height: 1.35;
}

.og-desc {
  margin: 0 0 0.6rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.og-site {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ink-muted);
}

@media (max-width: 880px) {
  .details {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}
</style>
