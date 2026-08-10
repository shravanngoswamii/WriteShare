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
  const all = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const out: FolderNode[] = [];
  for (const [path, count] of all) {
    const ancestors = path.split("/").slice(0, -1);
    let hidden = false;
    let accPath = "";
    for (const a of ancestors) {
      accPath = accPath ? `${accPath}/${a}` : a;
      if (collapsed.value.has(accPath)) {
        hidden = true;
        break;
      }
    }
    if (hidden) continue;
    out.push({ path, name: path.split("/").pop() ?? path, depth: ancestors.length, count });
  }
  return out;
});

function hasChildren(path: string): boolean {
  return props.files.some((f) => f.startsWith(`${props.root}/${path}/`));
}

const childPaths = computed(() => {
  const set = new Set<string>();
  for (const n of nodes.value) {
    const idx = n.path.lastIndexOf("/");
    if (idx > 0) set.add(n.path.slice(0, idx));
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
    <button class="rail-row" :class="{ active: selected === '' }" @click="emit('select', '')">
      <span class="rail-label">All posts</span>
      <span class="rail-count">{{ files.length }}</span>
    </button>
    <div v-for="n in nodes" :key="n.path" class="rail-row-wrap" :style="{ paddingLeft: `${n.depth * 14}px` }">
      <button
        v-if="childPaths.has(n.path) || hasChildren(n.path)"
        class="expander"
        :aria-label="collapsed.has(n.path) ? 'Expand' : 'Collapse'"
        @click.stop="toggle(n.path)"
      >
        <svg class="icon chevron" :class="{ closed: collapsed.has(n.path) }" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.646 5.646a.5.5 0 0 1 .708 0L8 9.293l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708z"
          />
        </svg>
      </button>
      <span v-else class="expander-spacer" />
      <button class="rail-row folder" :class="{ active: selected === n.path }" @click="emit('select', n.path)">
        <span class="rail-label">{{ n.name }}</span>
        <span class="rail-count">{{ n.count }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  background: transparent;
  padding: 0.25rem 0;
  align-self: start;
  position: sticky;
  top: 4.5rem;
  max-height: calc(100vh - 6rem);
  overflow: auto;
  min-width: 220px;
  border-right: 1.5px solid var(--separator);
  margin-right: -0.5rem;
  padding-right: 1rem;
}

.rail-row-wrap {
  display: flex;
  align-items: center;
}

.rail-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
  text-align: left;
  width: 100%;
}

.rail-row:hover:not(:disabled) {
  background: var(--fill);
}

.rail-row.active {
  background: transparent;
  color: var(--accent);
  font-weight: 700;
}

.rail-row:active:not(:disabled) {
  transform: none;
}

.rail-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
}

.rail-count {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.expander {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  flex-shrink: 0;
}

.expander-spacer {
  width: 22px;
  flex-shrink: 0;
}

.chevron {
  transition: transform 0.12s ease;
}

.chevron.closed {
  transform: rotate(-90deg);
}
</style>
