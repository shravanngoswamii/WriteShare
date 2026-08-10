<script setup lang="ts">
import { computed } from "vue";
import { cycleTheme, resolvedTheme, theme } from "@/stores/theme";

const label = computed(() =>
  theme.mode === "system" ? `Following your system (${resolvedTheme()})` : `Always ${theme.mode}`,
);
</script>

<template>
  <button class="theme-toggle quiet" :title="`${label}. Click for the next one.`" @click="cycleTheme">
    <svg v-if="theme.mode === 'light'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 11.5A3.5 3.5 0 1 1 8 4.5a3.5 3.5 0 0 1 0 7zm0-1.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM8 0a.6.6 0 0 1 .6.6v1.6a.6.6 0 0 1-1.2 0V.6A.6.6 0 0 1 8 0zm0 13.2a.6.6 0 0 1 .6.6v1.6a.6.6 0 0 1-1.2 0v-1.6a.6.6 0 0 1 .6-.6zM16 8a.6.6 0 0 1-.6.6h-1.6a.6.6 0 0 1 0-1.2h1.6A.6.6 0 0 1 16 8zM2.8 8a.6.6 0 0 1-.6.6H.6a.6.6 0 0 1 0-1.2h1.6a.6.6 0 0 1 .6.6zm10.85-5.65a.6.6 0 0 1 0 .85l-1.13 1.13a.6.6 0 1 1-.85-.85l1.13-1.13a.6.6 0 0 1 .85 0zM4.33 11.67a.6.6 0 0 1 0 .85L3.2 13.65a.6.6 0 0 1-.85-.85l1.13-1.13a.6.6 0 0 1 .85 0zm9.32 1.98a.6.6 0 0 1-.85 0l-1.13-1.13a.6.6 0 0 1 .85-.85l1.13 1.13a.6.6 0 0 1 0 .85zM4.33 4.33a.6.6 0 0 1-.85 0L2.35 3.2a.6.6 0 0 1 .85-.85l1.13 1.13a.6.6 0 0 1 0 .85z"
      />
    </svg>
    <svg v-else-if="theme.mode === 'dark'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"
      />
    </svg>
    <svg v-else class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.4v11.2A5.6 5.6 0 0 1 8 2.4z"
      />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
  color: var(--ink-muted);
}
</style>
