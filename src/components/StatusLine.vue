<script lang="ts">
export interface StatusItem {
  label?: string;
  value: string;
  tone?: "ok" | "busy" | "error" | "muted";
  href?: string;
  title?: string;
}
</script>

<script setup lang="ts">
defineProps<{
  mode: string;
  items?: StatusItem[];
  user?: { login: string; avatar_url: string } | null;
}>();
</script>

<template>
  <footer class="statusline">
    <span class="mode">{{ mode }}</span>
    <template v-for="(item, i) in items ?? []" :key="`${item.label ?? ''}${i}`">
      <a
        v-if="item.href"
        class="seg"
        :class="item.tone"
        :href="item.href"
        :title="item.title ?? item.value"
        target="_blank"
        rel="noreferrer"
      >
        <span v-if="item.label" class="seg-label">{{ item.label }}</span>{{ item.value }}
      </a>
      <span v-else class="seg" :class="item.tone" :title="item.title ?? item.value">
        <span v-if="item.label" class="seg-label">{{ item.label }}</span>{{ item.value }}
      </span>
    </template>
    <span class="gap" />
    <span v-if="user" class="seg user">
      <img class="avatar" :src="user.avatar_url" alt="" width="16" height="16" />
      {{ user.login }}
    </span>
  </footer>
</template>

<style scoped>
.statusline {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: stretch;
  height: 26px;
  background: var(--canvas);
  border-top: var(--edge) solid var(--ink);
  font-size: 0.7rem;
  overflow: hidden;
}

.mode {
  display: inline-flex;
  align-items: center;
  padding: 0 0.7rem;
  background: var(--ink);
  color: var(--canvas);
  font-weight: 700;
  letter-spacing: 0.14em;
  flex-shrink: 0;
}

.seg {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.7rem;
  min-width: 0;
  border-right: var(--hair) solid var(--separator);
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

a.seg:hover {
  background: var(--ink);
  color: var(--canvas);
}

.seg-label {
  color: var(--ink-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

a.seg:hover .seg-label {
  color: var(--canvas);
}

.ok {
  color: var(--ok);
}

.busy {
  color: var(--accent);
}

.error {
  color: var(--danger);
}

.muted {
  color: var(--ink-muted);
}

.gap {
  flex: 1;
  min-width: 0;
}

.user {
  border-right: none;
  border-left: var(--hair) solid var(--separator);
  flex-shrink: 0;
}

.avatar {
  display: block;
  border: var(--hair) solid var(--separator);
}

@media (max-width: 640px) {
  .seg:not(.user) {
    max-width: 40vw;
  }
}
</style>
