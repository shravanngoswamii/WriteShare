<script setup lang="ts">
import { Crepe } from "@milkdown/crepe";
import { onBeforeUnmount, onMounted, ref } from "vue";

import "@milkdown/crepe/theme/common/style.css";
import "katex/dist/katex.min.css";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

const host = ref<HTMLDivElement | null>(null);
let crepe: Crepe | null = null;
let ready = false;

onMounted(async () => {
  // Frame theme follows the OS/app appearance; only one theme CSS may load.
  await (window.matchMedia("(prefers-color-scheme: dark)").matches
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
</script>

<template>
  <div ref="host" class="md-editor" />
</template>

<style scoped>
/* Borderless "paper on canvas": radius + shadow separate it from the canvas. */
.md-editor {
  background: var(--paper);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
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
