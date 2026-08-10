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
        <h2 class="section-title">{{ title }}</h2>
        <p class="body">{{ body }}</p>
        <div class="actions">
          <button class="quiet" :disabled="busy" @click="emit('cancel')">Cancel</button>
          <button :class="danger ? 'destructive' : 'primary'" :disabled="busy" @click="emit('confirm')">
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
  background: rgba(0, 0, 0, 0.55);
}

.dialog {
  width: 100%;
  max-width: 420px;
  background: var(--paper);
  border: var(--edge) solid var(--ink);
  box-shadow: 6px 6px 0 var(--ink);
  padding: 0.9rem;
}

.dialog h2 {
  margin: 0 0 0.5rem;
}

.body {
  margin: 0 0 1rem;
  line-height: 1.55;
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
