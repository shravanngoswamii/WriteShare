<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { githubClient } from "@/stores/auth";
import { refreshPosts } from "@/stores/posts";
import { activeRepo, refreshRepoConfig, resolveConfig } from "@/stores/repos";
import { settings } from "@/stores/settings";
import { type Palette, setPalette, theme } from "@/stores/theme";
import { notify } from "@/stores/toasts";

const PALETTES: Array<{ id: Palette; name: string; light: string[]; dark: string[] }> = [
  {
    id: "washi",
    name: "Washi",
    light: ["#e9e6e0", "#fbfaf8", "#3f5d7d"],
    dark: ["#1b1b19", "#292927", "#94aec9"],
  },
  {
    id: "hinoki",
    name: "Hinoki",
    light: ["#e8e4da", "#faf8f3", "#5c7355"],
    dark: ["#1c1a15", "#2a2821", "#a3bd97"],
  },
  {
    id: "ash",
    name: "Ash",
    light: ["#e7e9eb", "#f9fafb", "#47606f"],
    dark: ["#191b1c", "#26292b", "#9db6c4"],
  },
];

const router = useRouter();
const target = computed(() => activeRepo());

const form = reactive({ contentPath: "", urlTemplate: "", commitTemplate: "" });
const busy = reactive({ reloading: false });

const componentsList = computed(() => (target.value ? resolveConfig(target.value).components : []));
const repoUrl = computed(() =>
  target.value ? `https://github.com/${target.value.owner}/${target.value.repo}` : "#",
);
const configSource = computed(() =>
  target.value?.configSource === "app" ? "this browser" : "writeshare.yml in the repository",
);

onMounted(() => {
  if (!target.value) {
    void router.push("/repos");
    return;
  }
  fillForm();
});

function fillForm(): void {
  const t = target.value;
  if (!t) return;
  const cfg = resolveConfig(t);
  form.contentPath = cfg.contentPath;
  form.urlTemplate = cfg.urlTemplate;
  form.commitTemplate = cfg.commitTemplate;
}

async function save(): Promise<void> {
  const t = target.value;
  if (!t) return;
  const nextPath = form.contentPath.trim().replace(/^\/+|\/+$/g, "") || t.contentPath;
  const pathChanged = nextPath !== t.contentPath;
  t.contentPath = nextPath;
  t.urlTemplate = form.urlTemplate.trim();
  t.commitTemplate = form.commitTemplate.trim() || undefined;
  t.configSource = "app";
  notify("Settings saved for this browser.", "ok");
  if (pathChanged) await refreshPosts();
}

async function reloadConfig(): Promise<void> {
  const t = target.value;
  if (!t) return;
  busy.reloading = true;
  try {
    await refreshRepoConfig(githubClient(), t);
    fillForm();
    await refreshPosts();
    notify("Reloaded writeshare.yml from the repository.", "ok");
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "error");
  } finally {
    busy.reloading = false;
  }
}
</script>

<template>
  <div class="view">
    <header class="view-header">
      <div class="view-heading">
        <h1 class="view-title">Settings</h1>
        <p v-if="target" class="view-sub mono">{{ target.owner }}/{{ target.repo }}</p>
      </div>
      <div class="view-actions">
        <a class="chip" :href="repoUrl" target="_blank" rel="noreferrer">Open on GitHub</a>
      </div>
    </header>

    <div class="view-body settings-body">
      <section class="settings-section">
        <div class="section-intro">
          <h2 class="section-title">This repository</h2>
          <p class="hint">
            Where posts live and how they are committed. Currently reading from {{ configSource }}.
          </p>
        </div>

        <div class="block">
          <div class="field">
            <label for="content-path">Content path</label>
            <input id="content-path" v-model="form.contentPath" type="text" placeholder="src/content/blog" />
            <p class="hint">The folder WriteShare lists and writes posts into.</p>
          </div>
          <div class="field">
            <label for="url-template">Preview URL</label>
            <input
              id="url-template"
              v-model="form.urlTemplate"
              type="text"
              placeholder="https://example.com/blog/{slug}/"
            />
            <p class="hint">{slug} is replaced with the file name. Leave it empty to hide permalinks.</p>
          </div>
          <div class="field">
            <label for="commit-template">Commit message</label>
            <input
              id="commit-template"
              v-model="form.commitTemplate"
              type="text"
              placeholder="{action} {path} (via WriteShare)"
            />
            <p class="hint">Tokens: {action}, {path}, {title}.</p>
          </div>
          <div v-if="componentsList.length" class="field">
            <label>Components</label>
            <div class="chips">
              <span v-for="c in componentsList" :key="c.name" class="chip" :title="c.description ?? c.name">
                {{ c.label }}
              </span>
            </div>
            <p class="hint">Declared in writeshare.yml and offered by the editor's Insert menu.</p>
          </div>
          <div class="block-actions">
            <button class="primary" @click="void save()">Save settings</button>
            <button :disabled="busy.reloading" @click="void reloadConfig()">
              {{ busy.reloading ? "Reloading" : "Reload writeshare.yml" }}
            </button>
          </div>
          <p class="hint">
            A
            <a :href="`${repoUrl}/blob/${target?.defaultBranch ?? 'main'}/writeshare.yml`" target="_blank" rel="noreferrer">
              writeshare.yml
            </a>
            in the repository root is the source of truth for everyone. Saving here overrides it for
            this browser only.
          </p>
        </div>
      </section>

      <section class="settings-section">
        <div class="section-intro">
          <h2 class="section-title">Writing</h2>
          <p class="hint">How your edits reach GitHub.</p>
        </div>

        <div class="block">
          <label class="checkbox-row">
            <input v-model="settings.autoSaveToGitHub" type="checkbox" />
            <span>Push every edit to GitHub automatically</span>
          </label>
          <p class="hint">
            Off by default. Edits are kept in this browser until you press Push, which keeps the
            branch history readable instead of one commit per keystroke.
          </p>
        </div>
      </section>

      <section class="settings-section">
        <div class="section-intro">
          <h2 class="section-title">Appearance</h2>
          <p class="hint">Palette applies to both light and dark.</p>
        </div>

        <div class="block">
          <div class="field">
            <label>Palette</label>
            <div class="palette-grid">
              <button
                v-for="p in PALETTES"
                :key="p.id"
                class="palette-card"
                :class="{ active: theme.palette === p.id }"
                :aria-pressed="theme.palette === p.id"
                @click="setPalette(p.id)"
              >
                <span class="swatches">
                  <span v-for="c in [...p.light, ...p.dark]" :key="c" class="swatch" :style="{ background: c }" />
                </span>
                <span class="palette-name">{{ p.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-body {
  display: grid;
  gap: 2.5rem;
  max-width: 1000px;
}

.settings-section {
  display: grid;
  grid-template-columns: minmax(0, 15rem) minmax(0, 34rem);
  gap: 2.5rem;
  align-items: start;
}

.section-intro .section-title {
  margin: 0 0 0.3rem;
}

.section-intro .hint {
  margin: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.block-actions {
  display: flex;
  gap: 0.5rem;
}

.palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.palette-card {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.75rem 0.45rem 0.5rem;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  font-weight: 400;
  color: var(--ink-soft);
}

.palette-card:hover:not(:disabled) {
  box-shadow: none;
}

.palette-card.active {
  border-color: var(--accent);
  color: var(--ink);
  font-weight: 500;
}

.swatches {
  display: flex;
  flex-shrink: 0;
}

.swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--separator);
}

.swatch + .swatch {
  margin-left: -5px;
}

.palette-name {
  font-size: 0.875rem;
}

@media (max-width: 900px) {
  .settings-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
}
</style>
