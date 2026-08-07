<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ (e: "confirm"): void; (e: "cancel"): void }>();

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit("cancel");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" role="dialog" aria-modal="true" :aria-label="title" @click="onBackdrop">
      <div class="dialog">
        <h2>{{ title }}</h2>
        <p class="muted body">{{ body }}</p>
        <div class="actions">
          <button :disabled="busy" @click="emit('cancel')">Cancel</button>
          <button class="primary" :class="{ danger }" :disabled="busy" @click="emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
}

.dialog {
  width: 100%;
  max-width: 420px;
  background: var(--paper);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.body {
  margin: 0 0 1rem;
  line-height: 1.5;
  font-size: 0.92rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.danger {
  background: var(--danger);
}
</style>
