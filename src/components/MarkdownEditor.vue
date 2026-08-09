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
/* Borderless "paper on canvas": radius + tonal contrast separate it. */
.md-editor {
  background: var(--paper);
  border-radius: var(--radius-lg);
  min-height: 70vh;
  overflow: hidden;
}

.md-editor :deep(.milkdown) {
  padding: 2rem 2.25rem;
  font-size: 1.02rem;
  line-height: 1.65;
}

@media (max-width: 640px) {
  .md-editor :deep(.milkdown) {
    padding: 1.25rem 1.1rem;
  }
}
</style>
