<script setup lang="ts">
import { dismiss, toasts } from "@/stores/toasts";
</script>

<template>
  <Teleport to="body">
    <div class="stack" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts.list" :key="t.id" class="toast" :class="t.tone">
          <span class="seal" :class="t.tone === 'ok' ? 'ok' : t.tone === 'error' ? 'danger' : ''" aria-hidden="true" />
          <span class="message">{{ t.message }}</span>
          <button v-if="t.action" class="quiet action" @click="t.action.run(); dismiss(t.id)">
            {{ t.action.label }}
          </button>
          <button class="quiet close" aria-label="Dismiss" @click="dismiss(t.id)">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4.65 4.65a.5.5 0 0 1 .7 0L8 7.3l2.65-2.65a.5.5 0 0 1 .7.7L8.7 8l2.65 2.65a.5.5 0 0 1-.7.7L8 8.7l-2.65 2.65a.5.5 0 0 1-.7-.7L7.3 8 4.65 5.35a.5.5 0 0 1 0-.7z"
              />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.stack {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 120;
  display: grid;
  gap: 0.5rem;
  width: max-content;
  max-width: min(520px, calc(100vw - 2rem));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.6rem 0.6rem 0.85rem;
  background: var(--raised);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-high);
  font-size: 0.875rem;
  pointer-events: auto;
}

.message {
  color: var(--ink);
}

.toast.error .message {
  color: var(--danger);
}

.action {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 0.8125rem;
}

.close {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  flex-shrink: 0;
  border-radius: 50%;
  color: var(--ink-muted);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--slow) var(--ease),
    transform var(--slow) var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
