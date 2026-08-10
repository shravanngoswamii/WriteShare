<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  defaultMessage: string;
  filePath: string;
  branch: string;
  pushing: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", message: string): void;
  (e: "cancel"): void;
}>();

const message = ref(props.defaultMessage);

watch(
  () => props.open,
  (open) => {
    if (open) message.value = props.defaultMessage;
  },
);

function confirm(): void {
  const m = message.value.trim();
  if (m) emit("confirm", m);
}

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit("cancel");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" role="dialog" aria-modal="true" aria-label="Push changes" @click="onBackdrop">
      <div class="dialog">
        <h2>Push changes</h2>
        <div class="meta">
          <span class="chip">{{ filePath }}</span>
          <span class="chip">{{ branch }}</span>
        </div>
        <div class="field">
          <label for="push-message">Commit message</label>
          <input id="push-message" v-model="message" type="text" autofocus @keydown.enter="confirm" />
        </div>
        <div class="actions">
          <button :disabled="pushing" @click="emit('cancel')">Cancel</button>
          <button class="primary" :disabled="pushing || !message.trim()" @click="confirm">
            {{ pushing ? "Pushing..." : "Push" }}
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
  max-width: 460px;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 1.25rem;
}

h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
