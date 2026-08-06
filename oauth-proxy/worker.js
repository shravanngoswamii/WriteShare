/**
 * WriteShare OAuth token-exchange proxy (Cloudflare Worker, free tier).
 *
 * Why this exists: GitHub's web OAuth flow ends with a `code -> access_token`
 * exchange that requires the app's client secret. A secret can never ship in
 * browser JavaScript, and GitHub's access_token endpoint does not allow CORS
 * from browsers, so a tiny exchange endpoint is the one thing a "serverless"
 * OAuth app cannot avoid. This is that endpoint. Everything else in
 * WriteShare talks to GitHub directly.
 *
 * Setup:
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler secret put GITHUB_CLIENT_ID
 *   wrangler secret put GITHUB_CLIENT_SECRET
 *   wrangler deploy --name writeshare-oauth oauth-proxy/worker.js
 * Then set CMS_CONFIG.auth.oauth.exchangeUrl in src/config.ts to its URL.
 *
 * Optional hardening: set ALLOWED_ORIGINS (comma-separated) as a secret too.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
    const corsOrigin = allowed.includes("*")
      ? "*"
      : allowed.includes(origin)
        ? origin
        : allowed[0] || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(corsOrigin) });
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405, corsOrigin);
    }

    let code;
    try {
      code = (await request.json()).code;
    } catch {
      return json({ error: "invalid JSON body" }, 400, corsOrigin);
    }
    if (!code) return json({ error: "missing code" }, 400, corsOrigin);

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const data = await res.json();
    if (data.error) {
      return json({ error: data.error_description || data.error }, 400, corsOrigin);
    }
    return json({ access_token: data.access_token }, 200, corsOrigin);
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
