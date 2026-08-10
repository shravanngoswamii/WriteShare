<script setup lang="ts">
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { Crepe } from "@milkdown/crepe";
import { Slice } from "prosemirror-model";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { resolvedTheme } from "@/stores/theme";

import "@milkdown/crepe/theme/common/style.css";
import "katex/dist/katex.min.css";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

const host = ref<HTMLDivElement | null>(null);
let crepe: Crepe | null = null;
let ready = false;

onMounted(async () => {
  // Frame theme follows the app theme store; only one theme CSS may load.
  await (resolvedTheme() === "dark"
    ? import("@milkdown/crepe/theme/frame-dark.css")
    : import("@milkdown/crepe/theme/frame.css"));

  if (!host.value) return;
  crepe = new Crepe({
    root: host.value,
    defaultValue: props.modelValue,
    features: {
      // Media pipeline (commit uploads to the repo) is roadmap work.
      [Crepe.Feature.ImageBlock]: false,
      [Crepe.Feature.Latex]: true,
    },
  });
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      if (ready) emit("update:modelValue", markdown);
    });
  });
  await crepe.create();
  ready = true;
});

onBeforeUnmount(() => {
  void crepe?.destroy();
});

/** Parse markdown (or raw component source) and insert it at the cursor. */
function insertSnippet(text: string): void {
  if (!crepe) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const doc = parser(text);
    view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView());
    view.focus();
  });
}

defineExpose({ insertSnippet });
</script>

<template>
  <div ref="host" class="md-editor" />
</template>

<style scoped>
/* The one soft surface in the app: chrome is mono, the writing is not. */
.md-editor {
  background: var(--paper);
  border: var(--edge) solid var(--ink);
  min-height: 68vh;
  overflow: hidden;
}

/* Crepe ships its own palette; point its variables at ours so the sheet
   belongs to the app and keeps following theme and palette changes. */
.md-editor :deep(.milkdown) {
  --crepe-color-background: var(--paper);
  --crepe-color-on-background: var(--ink);
  --crepe-color-surface: var(--paper);
  --crepe-color-surface-low: var(--fill);
  --crepe-color-on-surface: var(--ink);
  --crepe-color-on-surface-variant: var(--ink-muted);
  --crepe-color-outline: var(--separator);
  --crepe-color-primary: var(--accent);
  --crepe-color-secondary: var(--fill-strong);
  --crepe-color-on-secondary: var(--ink);
  --crepe-color-inverse: var(--ink);
  --crepe-color-on-inverse: var(--canvas);
  --crepe-color-inline-code: var(--mark);
  --crepe-color-error: var(--danger);
  --crepe-color-hover: var(--fill);
  --crepe-color-selected: var(--fill-strong);
  --crepe-color-inline-area: var(--fill);
  --crepe-font-title: var(--font-prose);
  --crepe-font-default: var(--font-prose);
  --crepe-font-code: var(--font-mono);
  --crepe-shadow-1: none;
  --crepe-shadow-2: none;

  padding: 0;
  font-size: 1rem;
  line-height: 1.7;
}

/* Crepe reserves 120px side gutters for block handles; 3rem is enough and
   keeps the measure where a reader wants it. */
.md-editor :deep(.ProseMirror) {
  max-width: 78ch;
  padding: 1.75rem 3rem 3rem;
}

.md-editor :deep(h1),
.md-editor :deep(h2),
.md-editor :deep(h3) {
  letter-spacing: -0.02em;
}

@media (max-width: 640px) {
  .md-editor :deep(.milkdown) {
    padding: 1.1rem 1rem;
  }
}
</style>
