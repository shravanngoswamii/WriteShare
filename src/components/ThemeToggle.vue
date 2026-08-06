<script setup lang="ts">
import { computed } from "vue";
import { cycleTheme, theme } from "@/stores/theme";

const label = computed(() => `Theme: ${theme.mode}. Click to change.`);
</script>

<template>
  <button class="theme-toggle" :aria-label="label" :title="label" @click="cycleTheme">
    <svg v-if="theme.mode === 'light'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zm9.657-4.243a.5.5 0 0 1 .707.707l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414zm-8.486 8.486a.5.5 0 0 1 .707.707L3.464 14.364a.5.5 0 1 1-.707-.707l1.414-1.414zM16 8a.5.5 0 0 1 .5-.5h-2a.5.5 0 0 1 0 1h2A.5.5 0 0 1 16 8zm-4.243 4.243a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 1 1-.707.707l-1.414-1.414zm-8.485-8.485a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 1 1-.707.707L3.757 4.464z"
      />
    </svg>
    <svg v-else-if="theme.mode === 'dark'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"
      />
    </svg>
    <svg v-else class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1a7 7 0 0 0-7 7 7 7 0 0 0 7 7 7 7 0 0 0 7-7 7 7 0 0 0-7-7zm0 1.5v11a5.5 5.5 0 0 1 0-11z"
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
  color: var(--ink-muted);
}
</style>
