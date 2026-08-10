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
        <p class="body">{{ body }}</p>
        <div class="actions">
          <button :disabled="busy" @click="emit('cancel')">Cancel</button>
          <button :class="danger ? 'destructive solid' : 'primary'" :disabled="busy" @click="emit('confirm')">
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
  background: rgba(20, 19, 17, 0.35);
  animation: fade var(--fast) var(--ease);
}

.dialog {
  width: 100%;
  max-width: 400px;
  background: var(--raised);
  border: 1px solid var(--separator);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-high);
  padding: 1.35rem;
  animation: lift var(--slow) var(--ease);
}

.dialog h2 {
  margin: 0 0 0.4rem;
  font-size: 1.0625rem;
}

.body {
  margin: 0 0 1.5rem;
  line-height: 1.6;
  font-size: 0.875rem;
  color: var(--ink-soft);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes lift {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
</style>
