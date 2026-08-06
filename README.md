# WriteShare

A serverless, Markdown-native writing desk for GitHub-backed blogs. Write from any device with a Medium-like WYSIWYG editor; every autosave is a commit on a `draft/*` branch, and publishing is a pull request. Sign in once with GitHub, no server and no database to operate.

Inspired by [Pages CMS](https://pagescms.org) (MIT): same GitHub-repo-as-database architecture, but WriteShare is writing-first (Markdown WYSIWYG, not an admin panel), autosaves every edit as a commit on a per-post draft branch, and opens PRs natively.

## How it works

```
Milkdown Crepe (WYSIWYG markdown)
        |  autosave (debounced)
        v
GitHub REST API -> draft/<slug> branch -> "Open PR" -> review -> merge -> your Astro deploy
```

- **Editor:** [Milkdown Crepe](https://milkdown.dev), a ProseMirror-based WYSIWYG that stores real Markdown (LaTeX via KaTeX), with light/dark themes.
- **Git ops:** Contents + Git Refs + Pulls REST APIs, called straight from the browser. Editing an existing post resumes its `draft/*` branch if one exists, otherwise it forks from the base branch on first save.
- **Auth:** one-click GitHub OAuth by default, with a personal access token as the no-setup fallback.

## Sign in with GitHub OAuth (default)

Same one-click experience as hosted CMS tools. The only piece of infrastructure OAuth fundamentally needs is a small token-exchange endpoint: GitHub's web flow trades `code -> access_token` using the app's client secret, which can never ship inside browser JavaScript (and GitHub's endpoint has no CORS). Hosted tools hide this because they run that endpoint; you run your own on Cloudflare's free tier once and never think about it again.

One-time setup, about five minutes, $0 forever:

1. Register an OAuth App at [github.com/settings/developers](https://github.com/settings/developers) (OAuth Apps -> New OAuth App): Homepage URL = where WriteShare is served, Authorization callback URL = the app origin root. You get a Client ID and Client Secret.
2. Deploy the proxy: `cd oauth-proxy`, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `ALLOWED_ORIGINS` with `wrangler secret put`, then `wrangler deploy` (uses `wrangler.toml` in this folder).
3. Fill `auth.oauth.clientId` and `auth.oauth.exchangeUrl` (the worker URL from step 2) in `src/config.ts`. Scope defaults to `public_repo`; use `repo` if your blog repo is private.

Done. The login screen shows **Continue with GitHub** and nothing else.

### Fallback: personal access token

On the login screen, expand "Use a personal access token". Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) scoped to your blog repository with **Contents: read/write** and **Pull requests: read/write** (a classic token with the `repo` scope also works). The token is stored only in that browser's `localStorage` and sent only to `api.github.com`.

## Develop

```sh
npm install
npm run dev
```

## Configure the content model

`src/config.ts` describes the repo, the collection path, and the frontmatter schema. Fields render as a proper form: dates, switches, tag lists, category chips. Defaults match the Astro `blog` collection of [shravanngoswamii.github.io](../shravanngoswamii.github.io/src/content.config.ts); a `study` collection slots in the same way when that section exists.

## Deploy

Static, same pattern as DrawShare: build with the right base path and publish `dist/` to GitHub Pages.

```sh
BASE_PATH=/WriteShare/ npm run build
```

The OAuth callback URL from step 1 must match the deployed origin.

## Roadmap

- [ ] Media uploads committed to the repo (image block in the editor)
- [ ] Load collection config from the repo (single source of truth)
- [ ] Code-split the editor bundle (currently ~1.6 MB with Milkdown and Shiki)
- [ ] Draft/PR status badges on the post list
- [ ] `study` collection and ink figures from DrawShare `.inkpack` bundles

## License

MIT, (c) 2026 Shravan Goswami. See [LICENSE](LICENSE). Architecture concept credit: [Pages CMS](https://github.com/pages-cms/pages-cms) (MIT).
