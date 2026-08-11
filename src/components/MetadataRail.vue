<script setup lang="ts">
import { computed } from "vue";
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

const title = computed(() => String(props.modelValue.title ?? "") || "Untitled");
const permalink = computed(() => permalinkFor(props.urlTemplate, props.slug));
const domain = computed(() => domainOf(permalink.value));
const description = computed(() => String(props.modelValue.description ?? ""));
</script>

<template>
  <aside class="rail" aria-label="Post details">
    <section class="rail-section">
      <h2 class="rail-heading">Details</h2>
      <FrontmatterForm
        :fields="fields"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </section>

    <section class="rail-section">
      <h2 class="rail-heading">Preview</h2>
      <template v-if="permalink">
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
        Add a preview URL in Settings to see the permalink and link preview for this post.
      </p>
    </section>
  </aside>
</template>

<style scoped>
.rail {
  display: grid;
  gap: 1.75rem;
  align-content: start;
  position: sticky;
  top: 1.5rem;
}

.rail-section {
  display: grid;
  gap: 0.75rem;
}

.rail-heading {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
}

.permalink {
  word-break: break-all;
  font-size: 0.78rem;
}

.og-card {
  background: var(--raised);
  border: 1px solid var(--separator);
  border-radius: var(--radius-md);
  padding: 0.85rem;
}

.og-title {
  margin: 0 0 0.3rem;
  font-weight: 500;
  line-height: 1.35;
}

.og-desc {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.og-site {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ink-muted);
}
</style>
