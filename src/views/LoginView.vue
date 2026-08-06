<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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
const patOpen = ref(false);

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
  auth.user = await githubClient().user();
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
    st.error = "That token did not work. Check its permissions (contents + pull requests).";
    st.busy = false;
  }
}

function useOAuth(): void {
  beginOAuth(oauth, "/");
}
</script>

<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="logo" aria-hidden="true">
        <img class="logo-img" :src="`${$baseUrl}favicon.svg`" alt="" width="76" height="76" />
      </div>

      <h1>WriteShare</h1>
      <p class="muted tagline">
        Your writing desk. Everything you write is a commit in your own GitHub repo: drafts live on branches,
        publishing is a pull request.
      </p>

      <p v-if="st.busy" class="muted">Checking your session...</p>

      <template v-else>
        <button v-if="oauthConfigured" class="github-btn" @click="useOAuth">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
          Continue with GitHub
        </button>

        <p v-else class="muted small oauth-note">
          One-click GitHub sign-in isn't configured yet (see the README's OAuth section). A personal access token
          works today:
        </p>

        <details class="pat-details" :open="!oauthConfigured">
          <summary>Use a personal access token</summary>
          <div class="field pat-field">
            <input
              id="pat"
              v-model="st.pat"
              type="password"
              placeholder="github_pat_..."
              autocomplete="off"
              aria-label="GitHub personal access token"
              @keydown.enter="void usePat()"
            />
          </div>
          <button class="primary pat-continue" :disabled="!st.pat.trim() || st.busy" @click="void usePat()">
            Continue
          </button>
        </details>

        <div v-if="st.error" class="banner">{{ st.error }}</div>

        <p class="muted small footnote">
          Tokens stay in this browser only. OAuth needs no account beyond GitHub. Setup takes five minutes and runs
          on a $0 worker.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.login-hero {
  width: 100%;
  max-width: 360px;
  text-align: center;
}

.logo-img {
  display: inline-block;
  border-radius: 22%;
  box-shadow: var(--shadow-card);
  margin-bottom: 1.25rem;
}

h1 {
  margin: 0 0 0.35rem;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.tagline {
  margin: 0 0 2rem;
  line-height: 1.55;
  font-size: 0.95rem;
}

.github-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  background: #1d1d1f;
  color: #ffffff;
  border-radius: 999px;
}

@media (prefers-color-scheme: dark) {
  .github-btn {
    background: #f5f5f7;
    color: #1d1d1f;
  }
}

.github-btn:hover:not(:disabled) {
  background: #333336;
}

@media (prefers-color-scheme: dark) {
  .github-btn:hover:not(:disabled) {
    background: #ffffff;
  }
}

.oauth-note {
  margin-bottom: 1rem;
}

.pat-details {
  margin-top: 0.5rem;
}

.pat-field {
  margin-top: 0.9rem;
}

.pat-continue {
  width: 100%;
  padding: 0.7rem;
}

.footnote {
  margin-top: 2.25rem;
  line-height: 1.5;
}
</style>
