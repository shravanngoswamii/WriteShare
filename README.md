<p align="center">
  <img src="public/logo.png" width="128" height="128" alt="WriteShare logo" />
</p>

<h1 align="center">WriteShare</h1>

> [!WARNING]
> Personal experiment built for my own usage, written with Kimi K3 in OpenCode. The code is not personally reviewed and comes with zero guarantees of correctness, security, or stability. Use at your own risk.

A serverless, Markdown-native writing desk for GitHub-backed blogs (Astro, Next, 11ty, Quarto, anything with Markdown files and frontmatter in a repo). WYSIWYG editing in the browser, edits live in local drafts until you *Push* them as a commit on a `draft/*` branch, publishing is a pull request. Works with any repository you can access; no server, no database.

## Usage

1. Sign in with GitHub (or paste a token).
2. Repositories screen: add any repo as `owner/repo` and point it at a content path (default `src/content/blog`); its default branch is detected automatically.
3. Posts screen: folder tree on the left, files on the right, dot marks unsaved local drafts. Compose or open one.
4. Editor: metadata in a collapsible top bar with permalink preview, body is WYSIWYG. Every edit is saved to the browser immediately. **Push** opens a dialog with an editable commit message (template-driven) and commits to `draft/<slug>`; **Open PR** publishes the review.
5. Repo > Manage: settings (content path, preview URL template, commit template), draft branch cleanup, and pull request merge (squash default, delete-branch-after-merge) or close.

Autosaving straight to GitHub (skipping the Push step) is available in settings under `writeshare.settings` via the editor, off by default.

## Configure a repo with writeshare.yml

Place at the repo root; fetched automatically, in-app Settings screen overrides it per browser.

```yaml
collections:
  - name: posts
    path: src/content/blog
    extension: .md
    fields:
      - { name: title, type: string, required: true }
      - { name: description, type: text }
      - { name: pubDatetime, type: date, required: true }
      - { name: draft, type: boolean, default: true }
      - { name: tags, type: string[] }
      - { name: categories, type: enum[], options: [tech, notes] }
    template:
      title: ""
      draft: true
preview:
  urlTemplate: "https://yoursite.com/blog/{slug}/"
commit:
  template: "{action} {path} (via WriteShare)"
```

Field types: `string`, `text`, `date`, `boolean`, `string[]`, `enum[]`. Commit template tokens: `{action}`, `{path}`, `{title}`. Extension is any suffix; `.qmd` makes WriteShare work on Quarto content (`.qmd` files are listed, created and edited; YAML frontmatter parses the same, shortcodes stay plain text).

### Components

Repos can declare their MDX/directive/shortcode components; the editor's **Insert** menu offers them and drops the source at the cursor:

```yaml
components:
  - name: note-callout
    label: Note callout
    description: Quarto-style callout block
    insert: |
      ::: {.callout-note}
      Write the note here.
      :::
  - name: plot
    label: Interactive plot
    insert: |
      <Plot expr="sin(x)/x" domain="[-10, 10]" />
```

Snippets are inserted as source text and round-trip untouched; the editor does not render the components themselves (that needs your site's build).

## Branches

Posts screen topbar has a branch picker: browse the default branch or any `draft/*` branch, and edits push to the branch you picked. When the working branch is the default branch, PR buttons hide because commits there publish directly.

## Permissions and sign-out

OAuth Apps are account-level grants, so GitHub shows no per-repo picker; repo selection happens inside WriteShare. The app asks for the `repo` scope because `public_repo` tokens got 404s from the git refs API even on public repos. To disconnect: GitHub Settings -> Applications -> Authorized OAuth Apps -> WriteShare -> Revoke. "Sign out" in the app wipes the local token.

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
