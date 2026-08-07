import { reactive } from "vue";
import { GitHubClient, type GitHubUser } from "@/lib/github";

const TOKEN_KEY = "writeshare.github-token";

interface AuthState {
  token: string;
  user: GitHubUser | null;
  /** OAuth scopes of the current token ("" for PATs or until validated). */
  scopes: string;
}

export const auth = reactive<AuthState>({
  token: localStorage.getItem(TOKEN_KEY) ?? "",
  user: null,
  scopes: "",
});

export function setToken(token: string): void {
  auth.token = token;
  localStorage.setItem(TOKEN_KEY, token);
  auth.user = null;
  auth.scopes = "";
}

export function logout(): void {
  auth.token = "";
  auth.user = null;
  auth.scopes = "";
  localStorage.removeItem(TOKEN_KEY);
}

export function githubClient(): GitHubClient {
  return new GitHubClient(auth.token);
}

// --- OAuth (optional path; see ../oauth-proxy) -----------------------------

const OAUTH_STATE_KEY = "writeshare.oauth-state";

export interface OAuthConfig {
  clientId: string;
  exchangeUrl: string;
  scope: string;
}

/** Kick off GitHub's web OAuth flow. */
export function beginOAuth(cfg: OAuthConfig): void {
  const state = crypto.randomUUID();
  localStorage.setItem(OAUTH_STATE_KEY, state);
  // The app deploys under a base path (e.g. /WriteShare/), and the callback
  // URL registered on GitHub must land right back here.
  const redirectUri = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: cfg.scope,
    state,
  });
  window.location.assign(`https://github.com/login/oauth/authorize?${params}`);
}

/** Handle the OAuth redirect back: returns true when a code was consumed. */
export async function completeOAuth(cfg: OAuthConfig): Promise<boolean> {
  const url = new URL(window.location.href);
  if (url.searchParams.get("error")) {
    const desc = url.searchParams.get("error_description") ?? "Sign-in was cancelled.";
    history.replaceState(null, "", `${url.origin}/${url.hash}`);
    throw new Error(desc);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return false;
  if (state !== localStorage.getItem(OAUTH_STATE_KEY)) {
    throw new Error("OAuth state mismatch, please try signing in again.");
  }
  localStorage.removeItem(OAUTH_STATE_KEY);
  const res = await fetch(cfg.exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error ?? "Token exchange failed.");
  }
  // Clean ?code&state out of the address bar, keep the hash route.
  history.replaceState(null, "", `${url.origin}/${url.hash}`);
  setToken(data.access_token);
  return true;
}
