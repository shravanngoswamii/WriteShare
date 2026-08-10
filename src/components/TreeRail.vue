<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  files: string[];
  root: string;
  selected: string; // "" = everything
}>();

const emit = defineEmits<(e: "select", folder: string) => void>();

interface FolderNode {
  path: string;
  name: string;
  depth: number;
  count: number;
  last: boolean;
}

const collapsed = ref(new Set<string>());

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const nodes = computed<FolderNode[]>(() => {
  const counts = new Map<string, number>();
  for (const file of props.files) {
    const rel = file.startsWith(`${props.root}/`) ? file.slice(props.root.length + 1) : file;
    const parts = rel.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      counts.set(acc, (counts.get(acc) ?? 0) + 1);
    }
  }
  const all = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const visible = all.filter(([path]) => {
    const ancestors = path.split("/").slice(0, -1);
    let acc = "";
    return !ancestors.some((a) => {
      acc = acc ? `${acc}/${a}` : a;
      return collapsed.value.has(acc);
    });
  });
  return visible.map(([path, count], i) => ({
    path,
    name: path.split("/").pop() ?? path,
    depth: path.split("/").length - 1,
    count,
    last: !visible.some(([other], j) => j > i && parentOf(other) === parentOf(path)),
  }));
});

const expandable = computed(() => {
  const set = new Set<string>();
  for (const file of props.files) {
    const rel = file.startsWith(`${props.root}/`) ? file.slice(props.root.length + 1) : file;
    const parts = rel.split("/");
    parts.pop();
    let acc = "";
    for (const [i, part] of parts.entries()) {
      acc = acc ? `${acc}/${part}` : part;
      if (i < parts.length - 1) set.add(acc);
    }
  }
  return set;
});

function toggle(path: string): void {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}
</script>

<template>
  <nav class="rail" aria-label="Folders">
    <button class="rail-row root" :class="{ active: selected === '' }" @click="emit('select', '')">
      <span class="rail-label">all posts</span>
      <span class="rail-count">{{ files.length }}</span>
    </button>

    <div v-for="n in nodes" :key="n.path" class="rail-line">
      <span class="glyph" :style="{ paddingLeft: `${n.depth * 0.9}rem` }" aria-hidden="true">
        {{ n.last ? "└─" : "├─" }}
      </span>
      <button
        v-if="expandable.has(n.path)"
        class="expander"
        :aria-label="`${collapsed.has(n.path) ? 'Expand' : 'Collapse'} ${n.name}`"
        @click.stop="toggle(n.path)"
      >
        {{ collapsed.has(n.path) ? "+" : "-" }}
      </button>
      <span v-else class="expander-gap" aria-hidden="true" />
      <button class="rail-row" :class="{ active: selected === n.path }" @click="emit('select', n.path)">
        <span class="rail-label">{{ n.name }}</span>
        <span class="rail-count">{{ n.count }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  align-self: stretch;
  position: sticky;
  top: 3.5rem;
  max-height: calc(100vh - 6rem);
  overflow: auto;
  padding: 0.35rem 0;
  border-right: var(--edge) solid var(--ink);
}

.rail-line {
  display: flex;
  align-items: center;
}

.glyph {
  color: var(--ink-muted);
  padding-right: 0.15rem;
  white-space: pre;
  flex-shrink: 0;
}

.rail-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  padding: 0.3rem 0.5rem;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.rail-row:hover:not(:disabled) {
  background: var(--ink);
  color: var(--canvas);
}

.rail-row.root {
  width: 100%;
  border-bottom: var(--hair) solid var(--separator);
}

.rail-row.active {
  background: var(--accent);
  color: var(--accent-ink);
}

.rail-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-count {
  font-size: 0.72rem;
  opacity: 0.7;
}

.expander {
  width: 1.1rem;
  border: var(--hair) solid var(--separator);
  background: transparent;
  color: var(--ink-muted);
  padding: 0;
  line-height: 1.1;
  font-size: 0.7rem;
  letter-spacing: 0;
  flex-shrink: 0;
}

.expander-gap {
  width: 1.1rem;
  flex-shrink: 0;
}

@media (max-width: 760px) {
  .rail {
    position: static;
    max-height: 200px;
    border-right: none;
    border-bottom: var(--edge) solid var(--ink);
  }
}
</style>
