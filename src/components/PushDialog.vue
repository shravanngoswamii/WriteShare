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
        <h2 class="section-title">push changes</h2>
        <dl class="meta">
          <dt>file</dt>
          <dd>{{ filePath }}</dd>
          <dt>branch</dt>
          <dd>{{ branch }}</dd>
        </dl>
        <div class="field">
          <label for="push-message">commit message</label>
          <input id="push-message" v-model="message" type="text" autofocus @keydown.enter="confirm" />
        </div>
        <div class="actions">
          <button class="quiet" :disabled="pushing" @click="emit('cancel')">Cancel</button>
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
  background: rgba(0, 0, 0, 0.55);
}

.dialog {
  width: 100%;
  max-width: 480px;
  background: var(--paper);
  border: var(--edge) solid var(--ink);
  box-shadow: 6px 6px 0 var(--accent);
  padding: 0.9rem;
}

.dialog h2 {
  margin: 0 0 0.6rem;
}

.meta {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.15rem 0.6rem;
  margin: 0 0 0.9rem;
  padding: 0.5rem 0.6rem;
  border: var(--hair) solid var(--separator);
  font-size: 0.76rem;
}

.meta dt {
  color: var(--ink-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
