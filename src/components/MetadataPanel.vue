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
      <span class="fence" aria-hidden="true">---</span>
      <span class="summary-title">{{ title }}</span>
      <span v-if="pubDate" class="chip">{{ pubDate }}</span>
      <span v-if="isDraft" class="chip">draft</span>
      <span v-for="c in categories" :key="c" class="chip">{{ c }}</span>
      <span class="gap" />
      <span class="toggle">{{ open ? "hide frontmatter" : "frontmatter" }}</span>
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
          <p class="label">permalink</p>
          <a class="permalink" :href="permalink" target="_blank" rel="noreferrer">{{ permalink }}</a>
          <div class="og-card">
            <p class="og-title">{{ title }}</p>
            <p class="og-desc" :class="{ muted: !description }">{{ description || "no description yet" }}</p>
            <p class="og-site">{{ domain }}</p>
          </div>
        </template>
        <p v-else class="hint">
          add a preview URL template in repo settings and the permalink shows up here.
        </p>
      </div>
    </div>
    <div v-show="open" class="fence-end" aria-hidden="true">---</div>
  </div>
</template>

<style scoped>
.panel {
  border: var(--edge) solid var(--ink);
  border-bottom: none;
  background: var(--paper);
}

.summary {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  background: transparent;
  border: none;
  padding: 0.55rem 0.7rem;
  text-align: left;
  font-size: 0.855rem;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.summary:hover:not(:disabled) {
  background: transparent;
}

.summary:hover .toggle {
  background: var(--ink);
  color: var(--canvas);
}

.fence,
.fence-end {
  color: var(--ink-muted);
  letter-spacing: 0.1em;
}

.fence-end {
  padding: 0 0.7rem 0.55rem;
  font-size: 0.855rem;
}

.summary-title {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 46ch;
}

.gap {
  flex: 1;
}

.toggle {
  flex-shrink: 0;
  padding: 0.1rem 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
  border: var(--hair) solid var(--separator);
}

.details {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 1.5rem;
  padding: 0.35rem 0.7rem 0.8rem;
}

.permalink {
  display: inline-block;
  margin-bottom: 0.75rem;
  word-break: break-all;
  font-size: 0.78rem;
}

.og-card {
  border: var(--hair) solid var(--separator);
  padding: 0.7rem;
}

.og-title {
  margin: 0 0 0.25rem;
  font-family: var(--font-prose);
  font-weight: 700;
  line-height: 1.3;
}

.og-desc {
  margin: 0 0 0.5rem;
  font-family: var(--font-prose);
  font-size: 0.85rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.og-site {
  margin: 0;
  font-size: 0.72rem;
  color: var(--ink-muted);
}

@media (max-width: 880px) {
  .details {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
