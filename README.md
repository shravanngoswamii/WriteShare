<p align="center">
  <img src="public/logo.png" width="128" height="128" alt="WriteShare logo" />
</p>

<h1 align="center">WriteShare</h1>

> [!WARNING]
> Personal experiment built for my own usage, written with Kimi K3 in OpenCode. The code is not personally reviewed and comes with zero guarantees of correctness, security, or stability. Use at your own risk.

A serverless, Markdown-native writing desk for GitHub-backed blogs. WYSIWYG editing in the browser, every autosave is a commit on a `draft/*` branch, publishing is a pull request. No server, no database.

## Stack

- Vue 3, TypeScript, Vite
- [Milkdown Crepe](https://milkdown.dev) WYSIWYG Markdown editor (KaTeX enabled)
- GitHub REST API direct from the browser (Contents, Refs, Pulls)
- Optional OAuth token-exchange worker in `oauth-proxy/` (Cloudflare free tier)

## OAuth setup, one time, $0

1. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers): Homepage URL `https://shravangoswami.com/WriteShare/`, callback URL `https://shravangoswami.com/`.
2. `cd oauth-proxy`, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGINS` via `wrangler secret put`, then `wrangler deploy`.
3. Fill `auth.oauth.clientId` and `auth.oauth.exchangeUrl` in `src/config.ts`.

## Develop

```sh
npm install
npm run dev
```

## Deploy

Push to `main`: `.github/workflows/deploy.yml` builds with `BASE_PATH=/WriteShare/` and publishes to `gh-pages`. Enable Pages (Repo Settings -> Pages, source = `gh-pages` branch) once, then it stays live at https://shravangoswami.com/WriteShare/.

## License

MIT, (c) 2026 Shravan Goswami. See [LICENSE](LICENSE). Architecture concept credit: [Pages CMS](https://github.com/pages-cms/pages-cms) (MIT).
