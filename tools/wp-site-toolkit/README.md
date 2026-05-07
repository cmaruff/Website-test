# WP Site Toolkit

Three tools for managing self-hosted WordPress sites on SiteGround through Git
+ Claude. **No Jetpack. No wordpress.com.** Just core WordPress REST API and
Application Passwords.

```
tools/wp-site-toolkit/
├── mcp/         # WordPress MCP server — let Claude read/edit any of your sites
├── workflows/   # GitHub Actions templates for per-site repos
└── bootstrap/   # One-time script: pull an existing site into a fresh repo
```

## The workflow this enables

1. You ask Claude: *"on Cairns Advertising, refresh the homepage hero copy."*
2. Claude reads the current page through the MCP server, drafts a rewrite, and
   opens a PR on that site's GitHub repo with the diff in a `content/` JSON file.
3. You review the diff in GitHub, comment, iterate.
4. You merge the PR.
5. GitHub Actions deploys: SFTPs any theme/plugin file changes to SiteGround
   AND POSTs content changes via the WordPress REST API.

The site is self-hosted on SiteGround the whole time. Nothing routes through
wordpress.com.

---

## 1. MCP server (`mcp/`)

A Node + TypeScript MCP server exposing WordPress REST as tools (list/get/update
pages and posts, list media, list menus, fetch Elementor templates, site info).

### Setup

```bash
cd tools/wp-site-toolkit/mcp
npm install
npm run build
```

### Register with Claude

In **Claude Desktop / Claude Code MCP config**, add one entry per site:

```json
{
  "mcpServers": {
    "wp-cairns-advertising": {
      "command": "node",
      "args": ["/abs/path/to/tools/wp-site-toolkit/mcp/dist/index.js"],
      "env": {
        "WP_URL": "https://cairnsadvertising.com.au",
        "WP_USER": "you@example.com",
        "WP_APP_PASSWORD": "xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

For multiple sites, add multiple entries. Each is a separate connection so
Claude knows which site it's writing to.

### Tools exposed

- `site_info` — confirm connection + which user is authenticated
- `list_pages` / `get_page` / `update_page`
- `list_posts` / `get_post` / `update_post` / `create_post`
- `list_media`
- `list_menus`
- `get_elementor_template`

All writes go straight through the REST API — there's no staging or undo, so
Claude should always preview a proposed change before calling `update_*`.

---

## 2. GitHub Actions workflows (`workflows/`)

Two workflow files to drop into each per-site repo at `.github/workflows/`:

- **`deploy-files.yml`** — on merge to `main`, rsyncs `theme/<slug>/`,
  `plugins/<slug>/`, and `mu-plugins/` to SiteGround over SFTP.
- **`deploy-content.yml`** — on merge to `main`, posts changed
  `content/pages/*.json`, `content/posts/*.json`, and `content/elementor/*.json`
  through the WordPress REST API using an Application Password.

### Required GitHub secrets per site repo

| Secret                  | Used by         | Where to get it                                         |
| ----------------------- | --------------- | ------------------------------------------------------- |
| `SITEGROUND_HOST`       | files           | SiteGround → Site Tools → Devs → SSH Keys → Hostname    |
| `SITEGROUND_PORT`       | files           | Same. SiteGround uses non-22 SSH ports.                 |
| `SITEGROUND_USER`       | files           | Same.                                                   |
| `SITEGROUND_KEY`        | files           | Generate an SSH key, add the public part to SiteGround. |
| `SITEGROUND_REMOTE_PATH`| files           | e.g. `/home/customer/www/site.com/public_html`          |
| `WP_URL`                | content         | Your site URL                                           |
| `WP_USER`               | content         | WP username or email                                    |
| `WP_APP_PASSWORD`       | content         | WP admin → Users → Profile → Application Passwords      |

### Per-site repo layout

```
<site-repo>/
├── .github/workflows/
│   ├── deploy-files.yml
│   └── deploy-content.yml
├── theme/
│   └── <theme-slug>/...           ← active theme code
├── plugins/
│   └── <plugin-slug>/...          ← any custom plugin code
├── mu-plugins/...                 ← must-use plugins
└── content/
    ├── site.json                  ← /wp-json (site info snapshot)
    ├── menus.json                 ← nav menus snapshot
    ├── pages/<slug>.json          ← editable pages with id + title + content
    ├── posts/<slug>.json
    └── elementor/<id>.json        ← (Elementor Pro) exported template JSON
```

---

## 3. Bootstrap script (`bootstrap/`)

One-time ingest of an existing SiteGround-hosted site into a fresh local repo.

### Phase 1 — content (always runs)

Pulls every page + post + menu via WP REST and writes them as JSON files under
`content/`.

### Phase 2 — files (optional)

If `SITEGROUND_HOST` / `SITEGROUND_PORT` / `SITEGROUND_USER` /
`SITEGROUND_REMOTE_PATH` env vars are set, rsyncs the active theme + custom
plugins into `theme/` and `plugins/`. Otherwise it prints the rsync commands
for you to run manually.

### Run

```bash
export WP_URL="https://cairnsadvertising.com.au"
export WP_USER="you@example.com"
export WP_APP_PASSWORD="xxxx xxxx xxxx xxxx"

# optional, for phase 2:
export SITEGROUND_HOST="ssh.cairnsadvertising.com.au"
export SITEGROUND_PORT="18765"
export SITEGROUND_USER="customer-username"
export SITEGROUND_REMOTE_PATH="/home/customer/www/cairnsadvertising.com.au/public_html"

node tools/wp-site-toolkit/bootstrap/ingest.mjs --out ./cairns-advertising
```

After it finishes:

```bash
cd cairns-advertising
git init
git add .
git commit -m "bootstrap: ingest existing site"
gh repo create cairns-advertising --private --source=. --push
```

Drop the workflow files into `.github/workflows/`, set the secrets in the new
repo, and you're done. From here on Claude proposes changes via PR, you review,
you merge, it deploys.

---

## Why no Jetpack

The standard claude.ai WordPress connector uses wordpress.com OAuth, which
requires Jetpack on the host site as a bridge. This toolkit skips that entire
layer:

- **Smaller WP install** — no Jetpack bloat or stats phoning home.
- **Direct API surface** — talking to `/wp-json/` on your own server, not
  proxying through Automattic.
- **Same security model as wp-admin** — Application Passwords are a built-in
  WP feature with proper revocation. Add a dedicated "Editor" WP user for
  Claude with only the role it needs.
- **Fully self-hosted** — every byte of content stays between you, SiteGround,
  and GitHub.

The cost is that you can't use the official one-click connector — you have to
register the MCP server yourself. About 30 seconds per site, once.
