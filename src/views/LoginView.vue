<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { CMS_CONFIG } from "@/config";
import { auth, beginOAuth, completeOAuth, githubClient, logout, setToken } from "@/stores/auth";

const router = useRouter();
const oauth = CMS_CONFIG.auth.oauth;
const $baseUrl = import.meta.env.BASE_URL;

const oauthConfigured = computed(
  () => CMS_CONFIG.auth.method === "oauth" && Boolean(oauth.clientId) && Boolean(oauth.exchangeUrl),
);

const st = reactive({ pat: "", busy: true, error: "" });

onMounted(async () => {
  // 1) Finish an OAuth round-trip, if one is in progress.
  if (oauthConfigured.value) {
    try {
      if (await completeOAuth(oauth)) {
        await enter();
        return;
      }
    } catch (err) {
      st.error = err instanceof Error ? err.message : String(err);
      st.busy = false;
      return;
    }
  }
  // 2) Existing stored token: validate once, then go straight in.
  if (auth.token) {
    try {
      auth.user = await githubClient().user();
      void router.replace("/posts");
      return;
    } catch {
      logout();
    }
  }
  st.busy = false;
});

async function enter(): Promise<void> {
  const { user, scopes } = await githubClient().userWithScopes();
  auth.user = user;
  auth.scopes = scopes;
  void router.replace("/posts");
}

async function usePat(): Promise<void> {
  const token = st.pat.trim();
  if (!token) return;
  st.busy = true;
  st.error = "";
  try {
    setToken(token);
    await enter();
  } catch {
    logout();
    st.error = "GitHub rejected that token. It needs contents and pull request access.";
    st.busy = false;
  }
}

function useOAuth(): void {
  beginOAuth(oauth);
}
</script>

<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="masthead">
        <img class="logo" :src="`${$baseUrl}favicon.svg`" alt="" width="44" height="44" />
        <h1>WriteShare</h1>
      </div>

      <p class="tagline">
        A quiet writing desk for a GitHub-backed blog. Every post is a commit in your own repository:
        drafts live on branches, publishing is a pull request.
      </p>

      <div class="auth">
        <p v-if="st.busy" class="muted small">Checking your session...</p>

        <template v-else>
          <button v-if="oauthConfigured" class="primary github-btn" @click="useOAuth">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              />
            </svg>
            Sign in with GitHub
          </button>

          <p v-else class="hint no-oauth">
            One-click sign-in isn't set up yet (see the README's OAuth section). A personal access token
            works today.
          </p>

          <details class="pat" :open="!oauthConfigured">
            <summary>Use a personal access token</summary>
            <div class="pat-body">
              <div class="field">
                <label for="pat">Token</label>
                <input
                  id="pat"
                  v-model="st.pat"
                  type="password"
                  placeholder="github_pat_..."
                  autocomplete="off"
                  @keydown.enter="void usePat()"
                />
              </div>
              <button class="primary" :disabled="!st.pat.trim() || st.busy" @click="void usePat()">
                Sign in
              </button>
            </div>
          </details>

          <div v-if="st.error" class="notice"><span>{{ st.error }}</span></div>
        </template>
      </div>

      <p class="hint outro">
        Your token stays in this browser and nowhere else. No server, no database.
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  justify-content: center;
  align-content: center;
  padding: 4rem 1.5rem;
}

.login-hero {
  width: 100%;
  max-width: 400px;
}

.masthead {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.logo {
  display: block;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-mid);
}

h1 {
  margin: 0;
  font-size: 1.875rem;
  font-weight: 400;
  letter-spacing: -0.025em;
}

.tagline {
  margin: 1.5rem 0 2rem;
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--ink-soft);
}

.auth {
  display: grid;
  gap: 1rem;
  padding: 1.35rem;
  background: var(--paper);
  border: 1px solid var(--separator);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-low);
}

.github-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.7rem 1rem;
  font-size: 0.9375rem;
}

.no-oauth {
  margin: 0;
}

.pat > summary {
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ink-muted);
  list-style: none;
  padding: 0.2rem 0;
  transition: color var(--fast) var(--ease);
}

.pat > summary::marker,
.pat > summary::-webkit-details-marker {
  display: none;
}

.pat > summary:hover {
  color: var(--ink);
}

.pat-body {
  display: grid;
  gap: 0.9rem;
  padding-top: 1rem;
}

.outro {
  margin-top: 1.5rem;
  padding: 0 0.2rem;
}
</style>
