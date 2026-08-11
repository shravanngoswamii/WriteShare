<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import FolderTree from "@/components/FolderTree.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { auth, githubClient, logout } from "@/stores/auth";
import { pendingCount, pipeline, refreshPipeline } from "@/stores/pipeline";
import { postsState, refreshPosts } from "@/stores/posts";
import { activeRepo, refreshRepoConfig, repos, setActive } from "@/stores/repos";

const route = useRoute();
const router = useRouter();
const $baseUrl = import.meta.env.BASE_URL;

const target = computed(() => activeRepo());
const currentBranch = computed(
  () => target.value?.workingBranch || target.value?.defaultBranch || "main",
);
const onDefaultBranch = computed(() => !target.value?.workingBranch);

const repoMenuOpen = ref(false);
const branchMenuOpen = ref(false);
const drawerOpen = ref(false);

/** Folders navigate by URL so back, forward and shared links all behave. */
const selectedFolder = computed(() =>
  typeof route.query.folder === "string" ? route.query.folder : "",
);
const showFolders = computed(() => route.path === "/posts" && postsState.files.length > 0);
const pending = computed(() => pendingCount());

onMounted(async () => {
  if (!auth.user) {
    try {
      auth.user = await githubClient().user();
    } catch {
      // Surfaced by whichever screen needs the API; the shell stays usable.
    }
  }
  const repo = target.value;
  if (repo && !repo.configCheckedAt) {
    void refreshRepoConfig(githubClient(), repo).catch(() => {});
  }
  void refreshPipeline();
});

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    repoMenuOpen.value = false;
    branchMenuOpen.value = false;
    drawerOpen.value = false;
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

function selectFolder(folder: string): void {
  void router.push({ path: "/posts", query: folder ? { folder } : {} });
}

async function switchRepo(index: number): Promise<void> {
  setActive(index);
  repoMenuOpen.value = false;
  const repo = repos.list[index];
  if (repo && !repo.configCheckedAt) {
    void refreshRepoConfig(githubClient(), repo).catch(() => {});
  }
  await Promise.all([refreshPosts(), refreshPipeline(true)]);
  void router.push("/posts");
}

async function chooseBranch(branch: string): Promise<void> {
  const t = target.value;
  if (!t) return;
  t.workingBranch = branch || undefined;
  branchMenuOpen.value = false;
  await refreshPosts();
  if (route.path !== "/posts") void router.push("/posts");
}

function signOut(): void {
  logout();
  void router.push("/login");
}
</script>

<template>
  <div class="shell">
    <button
      class="quiet drawer-toggle"
      aria-label="Menu"
      :aria-expanded="drawerOpen"
      @click="drawerOpen = !drawerOpen"
    >
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 3.75h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5zm0 4h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5zm0 4h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5z" />
      </svg>
    </button>
    <div v-if="drawerOpen" class="drawer-backdrop" @click="drawerOpen = false" />

    <aside class="sidebar" :class="{ open: drawerOpen }">
      <div class="brand">
        <img class="brand-mark" :src="`${$baseUrl}favicon.svg`" alt="" width="22" height="22" />
        <span class="brand-name">WriteShare</span>
      </div>

      <div class="context-block">
        <div class="picker">
          <button class="picker-btn" :aria-expanded="repoMenuOpen" @click="repoMenuOpen = !repoMenuOpen">
            <span class="picker-label">
              <span class="picker-kicker">Repository</span>
              <span class="picker-value truncate" :title="target ? `${target.owner}/${target.repo}` : ''">
                {{ target ? `${target.owner}/${target.repo}` : "None selected" }}
              </span>
            </span>
            <svg class="icon caret" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.22 6.28a.75.75 0 0 1 1.06-.06L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1z" />
            </svg>
          </button>
          <div v-if="repoMenuOpen" class="menu-backdrop" @click="repoMenuOpen = false" />
          <div v-if="repoMenuOpen" class="menu-panel picker-panel">
            <button
              v-for="(r, i) in repos.list"
              :key="`${r.owner}/${r.repo}`"
              class="menu-item"
              @click="void switchRepo(i)"
            >
              <span class="menu-label truncate">{{ r.owner }}/{{ r.repo }}</span>
              <span v-if="r === target" class="menu-sub">Current</span>
            </button>
            <button
              class="menu-item"
              @click="
                repoMenuOpen = false;
                void router.push('/repos');
              "
            >
              <span class="menu-label">Manage repositories...</span>
            </button>
          </div>
        </div>

        <div class="picker">
          <button
            class="picker-btn"
            :aria-expanded="branchMenuOpen"
            @click="branchMenuOpen = !branchMenuOpen"
          >
            <span class="picker-label">
              <span class="picker-kicker">Browsing</span>
              <span class="picker-value mono truncate">{{ currentBranch }}</span>
            </span>
            <svg class="icon caret" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.22 6.28a.75.75 0 0 1 1.06-.06L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1z" />
            </svg>
          </button>
          <div v-if="branchMenuOpen" class="menu-backdrop" @click="branchMenuOpen = false" />
          <div v-if="branchMenuOpen" class="menu-panel picker-panel">
            <button class="menu-item" :disabled="onDefaultBranch" @click="void chooseBranch('')">
              <span class="menu-label mono">{{ target?.defaultBranch ?? "main" }}</span>
              <span class="menu-sub">Published posts</span>
            </button>
            <button
              v-for="b in pipeline.branches"
              :key="b"
              class="menu-item"
              :disabled="b === target?.workingBranch"
              @click="void chooseBranch(b)"
            >
              <span class="menu-label mono truncate">{{ b }}</span>
              <span class="menu-sub">{{ b === target?.workingBranch ? "Current" : "Draft branch" }}</span>
            </button>
            <p v-if="!pipeline.branches.length" class="menu-empty">
              No draft branches yet. One appears the first time you push a post.
            </p>
          </div>
        </div>
        <p class="branch-note">
          <template v-if="onDefaultBranch">
            Edits you push get their own draft branch, so nothing reaches
            {{ target?.defaultBranch ?? "the default branch" }} until a pull request is merged.
          </template>
          <template v-else>Edits you push go straight onto this branch.</template>
        </p>
      </div>

      <nav class="nav" aria-label="Sections">
        <router-link
          class="nav-item"
          :class="{ active: route.path === '/posts' && !selectedFolder }"
          to="/posts"
        >
          <span>All posts</span>
          <span v-if="postsState.files.length" class="nav-count">{{ postsState.files.length }}</span>
        </router-link>

        <FolderTree
          v-if="showFolders && target"
          class="nav-tree"
          :files="postsState.files"
          :root="target.contentPath"
          :selected="selectedFolder"
          @select="selectFolder"
        />

        <router-link class="nav-item" :class="{ active: route.path === '/review' }" to="/review">
          <span>Review</span>
          <span v-if="pending" class="nav-count badge">{{ pending }}</span>
        </router-link>

        <router-link class="nav-item" :class="{ active: route.path === '/settings' }" to="/settings">
          <span>Settings</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user">
          <img
            v-if="auth.user"
            class="avatar"
            :src="auth.user.avatar_url"
            :alt="auth.user.login"
            width="24"
            height="24"
          />
          <span class="user-name truncate">{{ auth.user?.login ?? "Signed in" }}</span>
          <ThemeToggle />
        </div>
        <button class="quiet sign-out" @click="signOut">Sign out</button>
      </div>
    </aside>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.1rem 0.85rem 1rem;
  border-right: 1px solid var(--separator);
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.35rem;
}

.brand-mark {
  display: block;
  border-radius: var(--radius-sm);
}

.brand-name {
  font-size: 0.9375rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.context-block {
  display: grid;
  gap: 0.4rem;
}

.picker {
  position: relative;
}

.picker-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  background: var(--paper);
  text-align: left;
}

.picker-label {
  flex: 1;
  min-width: 0;
  display: grid;
}

.picker-kicker {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--ink-muted);
}

.picker-value {
  font-size: 0.8125rem;
  font-weight: 500;
}

.picker-panel {
  left: 0;
  right: 0;
  min-width: 0;
}

.caret {
  color: var(--ink-muted);
  flex-shrink: 0;
}

.menu-label {
  font-size: 0.8125rem;
}

.menu-sub {
  font-size: 0.6875rem;
  color: var(--ink-muted);
}

.menu-empty {
  margin: 0;
  padding: 0.5rem 0.6rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ink-muted);
}

.branch-note {
  margin: 0.1rem 0.35rem 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--ink-muted);
}

.nav {
  display: grid;
  gap: 1px;
  align-content: start;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--ink-soft);
  text-decoration: none;
  transition: background-color var(--fast) var(--ease);
}

.nav-item:hover {
  background: var(--fill);
  color: var(--ink);
  text-decoration: none;
}

.nav-item.active {
  background: var(--fill-strong);
  color: var(--ink);
  font-weight: 500;
}

.nav-item span:first-child {
  flex: 1;
}

.nav-count {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.nav-count.badge {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.nav-tree {
  margin: 0.15rem 0 0.5rem;
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 0.35rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--separator);
}

.user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.3rem;
}

.avatar {
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

.user-name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  color: var(--ink-soft);
}

.sign-out {
  justify-self: start;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.main {
  min-width: 0;
}

.drawer-toggle,
.drawer-backdrop {
  display: none;
}

@media (max-width: 900px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .drawer-toggle {
    display: grid;
    place-items: center;
    position: fixed;
    top: 0.7rem;
    left: 0.7rem;
    z-index: 60;
    width: 36px;
    height: 36px;
    padding: 0;
    background: var(--paper);
    border-color: var(--separator);
    box-shadow: var(--shadow-mid);
  }

  .drawer-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(20, 19, 17, 0.35);
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 80;
    width: min(280px, 82vw);
    background: var(--canvas);
    box-shadow: var(--shadow-high);
    transform: translateX(-102%);
    transition: transform var(--slow) var(--ease);
  }

  .sidebar.open {
    transform: none;
  }
}
</style>
