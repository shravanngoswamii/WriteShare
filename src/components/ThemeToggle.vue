<script setup lang="ts">
import { computed } from "vue";
import { cycleTheme, resolvedTheme, theme } from "@/stores/theme";

const label = computed(() => (theme.mode === "system" ? `auto:${resolvedTheme()}` : theme.mode));
</script>

<template>
  <button
    class="theme-toggle quiet"
    :title="`Theme is ${label}. Click for the next one.`"
    @click="cycleTheme"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.theme-toggle {
  flex-shrink: 0;
  color: var(--ink-muted);
  padding: 0.35rem 0.6rem;
  text-transform: none;
  letter-spacing: 0.04em;
}

.theme-toggle:hover:not(:disabled) {
  color: var(--canvas);
}
</style>
