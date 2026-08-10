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
        <dl class="meta">
          <dt>File</dt>
          <dd class="mono">{{ filePath }}</dd>
          <dt>Branch</dt>
          <dd class="mono">{{ branch }}</dd>
        </dl>
        <div class="field">
          <label for="push-message">Commit message</label>
          <input id="push-message" v-model="message" type="text" autofocus @keydown.enter="confirm" />
        </div>
        <div class="actions">
          <button :disabled="pushing" @click="emit('cancel')">Cancel</button>
          <button class="primary" :disabled="pushing || !message.trim()" @click="confirm">
            {{ pushing ? "Pushing" : "Push" }}
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
  max-width: 460px;
  background: var(--raised);
  border: 1px solid var(--separator);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-high);
  padding: 1.35rem;
  animation: lift var(--slow) var(--ease);
}

.dialog h2 {
  margin: 0 0 0.9rem;
  font-size: 1.0625rem;
}

.meta {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.3rem 1rem;
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
}

.meta dt {
  color: var(--ink-muted);
}

.meta dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink-soft);
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
