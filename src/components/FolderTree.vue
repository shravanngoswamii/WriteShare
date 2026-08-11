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
}

const collapsed = ref(new Set<string>());

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
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([path]) => {
      const ancestors = path.split("/").slice(0, -1);
      let acc = "";
      return !ancestors.some((a) => {
        acc = acc ? `${acc}/${a}` : a;
        return collapsed.value.has(acc);
      });
    })
    .map(([path, count]) => ({
      path,
      name: path.split("/").pop() ?? path,
      depth: path.split("/").length - 1,
      count,
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
  <div class="tree">
    <div v-for="n in nodes" :key="n.path" class="tree-line">
      <button
        class="tree-row"
        :class="{ active: selected === n.path }"
        :style="{ paddingLeft: `${0.9 + n.depth * 0.8}rem` }"
        @click="emit('select', n.path)"
      >
        <span class="tree-label">{{ n.name }}</span>
        <span class="tree-count">{{ n.count }}</span>
      </button>
      <button
        v-if="expandable.has(n.path)"
        class="expander"
        :aria-label="`${collapsed.has(n.path) ? 'Expand' : 'Collapse'} ${n.name}`"
        @click.stop="toggle(n.path)"
      >
        <svg class="icon caret" :class="{ closed: collapsed.has(n.path) }" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.22 6.28a.75.75 0 0 1 1.06-.06L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: grid;
  gap: 1px;
}

.tree-line {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.tree-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  box-shadow: none;
  padding: 0.3rem 0.6rem 0.3rem 0.9rem;
  text-align: left;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--ink-soft);
  transition: background-color var(--fast) var(--ease);
}

.tree-row:hover:not(:disabled) {
  background: var(--fill);
  box-shadow: none;
  color: var(--ink);
}

.tree-row.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-count {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.tree-row.active .tree-count {
  color: var(--accent);
  opacity: 0.75;
}

.expander {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: none;
  color: var(--ink-muted);
  flex-shrink: 0;
}

.expander:hover:not(:disabled) {
  background: var(--fill-strong);
  box-shadow: none;
  color: var(--ink);
}

.caret {
  transition: transform var(--fast) var(--ease);
}

.caret.closed {
  transform: rotate(-90deg);
}
</style>
