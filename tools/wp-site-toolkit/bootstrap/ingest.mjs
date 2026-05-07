#!/usr/bin/env node
/**
 * One-time bootstrap: pull an existing SiteGround-hosted WordPress site into
 * a fresh local repo so it can be managed via Git from then on.
 *
 * Two phases:
 *   1. Content: WP REST API → content/pages/<slug>.json,
 *      content/posts/<slug>.json, content/menus.json, content/site.json
 *   2. Files: SFTP/SSH-rsync the active theme + custom plugins down into
 *      theme/<slug>/ and plugins/<slug>/.
 *
 * Phase 1 needs: WP_URL, WP_USER, WP_APP_PASSWORD
 * Phase 2 needs: SITEGROUND_HOST, SITEGROUND_PORT, SITEGROUND_USER,
 *                SITEGROUND_REMOTE_PATH, plus an SSH key on this machine
 *                (or the user runs the printed rsync commands manually).
 *
 * Usage:
 *   node ingest.mjs --out ./cairns-advertising
 *   node ingest.mjs --out ./cairns-advertising --skip-files
 *   node ingest.mjs --out ./cairns-advertising --print-rsync-only
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.out ?? ".");
const skipFiles = !!args["skip-files"];
const printRsyncOnly = !!args["print-rsync-only"];

const WP_URL = requireEnv("WP_URL").replace(/\/+$/, "");
const WP_USER = requireEnv("WP_USER");
const WP_APP_PASSWORD = requireEnv("WP_APP_PASSWORD").replace(/\s+/g, "");

const auth =
  "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(path.join(outDir, "content/pages"), { recursive: true });
await fs.mkdir(path.join(outDir, "content/posts"), { recursive: true });

console.log(`▸ Bootstrap: ${WP_URL} → ${outDir}`);

// ---------- Phase 1: content via REST ----------

const site = await wp("/wp-json");
await write("content/site.json", site);

const me = await wp("/wp-json/wp/v2/users/me?context=edit");
console.log(`  authenticated as ${me.name} (roles: ${(me.roles ?? []).join(", ") || "n/a"})`);

let page = 1, total = 0;
while (true) {
  const pages = await wp(`/wp-json/wp/v2/pages?context=edit&per_page=100&status=any&page=${page}`);
  if (!pages.length) break;
  for (const p of pages) {
    const slug = p.slug || `page-${p.id}`;
    await write(`content/pages/${slug}.json`, {
      id: p.id,
      slug: p.slug,
      status: p.status,
      title: p.title?.raw,
      content: p.content?.raw,
      excerpt: p.excerpt?.raw,
      meta: p.meta,
      modified: p.modified,
      link: p.link,
    });
    total++;
  }
  page++;
}
console.log(`  ✓ ${total} pages`);

let postPage = 1, postTotal = 0;
while (true) {
  const posts = await wp(`/wp-json/wp/v2/posts?context=edit&per_page=100&status=any&page=${postPage}`);
  if (!posts.length) break;
  for (const p of posts) {
    const slug = p.slug || `post-${p.id}`;
    await write(`content/posts/${slug}.json`, {
      id: p.id,
      slug: p.slug,
      status: p.status,
      title: p.title?.raw,
      content: p.content?.raw,
      excerpt: p.excerpt?.raw,
      meta: p.meta,
      modified: p.modified,
      link: p.link,
    });
    postTotal++;
  }
  postPage++;
}
console.log(`  ✓ ${postTotal} posts`);

try {
  const menus = await wp("/wp-json/wp/v2/menus?context=edit&per_page=100");
  await write("content/menus.json", menus);
  console.log(`  ✓ ${menus.length} menus`);
} catch (e) {
  console.warn(`  ! menus skipped (${e.message})`);
}

// Active theme — needed for phase 2.
const settings = await wp("/wp-json/wp/v2/settings");
const themeSlug = settings?.template ?? null;
console.log(`  active theme: ${themeSlug ?? "(unknown)"}`);
await write(".active-theme", themeSlug ?? "unknown");

// ---------- Phase 2: theme + plugin files via rsync ----------

if (skipFiles) {
  console.log("▸ Skipping file sync (--skip-files)");
  done();
}

const sgHost = process.env.SITEGROUND_HOST;
const sgPort = process.env.SITEGROUND_PORT ?? "22";
const sgUser = process.env.SITEGROUND_USER;
const sgRemote = process.env.SITEGROUND_REMOTE_PATH;

if (!sgHost || !sgUser || !sgRemote) {
  console.log(
    "▸ SiteGround SFTP env not set; skipping file sync.\n" +
    "  To pull the theme + plugins later, set SITEGROUND_HOST / SITEGROUND_PORT / " +
    "SITEGROUND_USER / SITEGROUND_REMOTE_PATH and re-run, or run:\n" +
    `  rsync -avz -e 'ssh -p <PORT>' <USER>@<HOST>:${sgRemote ?? "<REMOTE>"}/wp-content/themes/${themeSlug}/ ${path.join(outDir, "theme", themeSlug ?? "active")}/`
  );
  done();
}

if (printRsyncOnly) {
  console.log(rsyncCmd(`${sgRemote}/wp-content/themes/${themeSlug}/`, `theme/${themeSlug}/`));
  console.log(rsyncCmd(`${sgRemote}/wp-content/plugins/`, `plugins/`));
  console.log(rsyncCmd(`${sgRemote}/wp-content/mu-plugins/`, `mu-plugins/`));
  done();
}

console.log("▸ Pulling theme + plugins via rsync");
await fs.mkdir(path.join(outDir, `theme/${themeSlug}`), { recursive: true });
await fs.mkdir(path.join(outDir, "plugins"), { recursive: true });
await fs.mkdir(path.join(outDir, "mu-plugins"), { recursive: true });

run(rsyncCmd(`${sgRemote}/wp-content/themes/${themeSlug}/`, `theme/${themeSlug}/`));
run(rsyncCmd(`${sgRemote}/wp-content/plugins/`, `plugins/`));
run(rsyncCmd(`${sgRemote}/wp-content/mu-plugins/`, `mu-plugins/`));
console.log("  ✓ files pulled");

done();

// ---------- helpers ----------

function done() {
  console.log("\n✓ Bootstrap complete.");
  console.log(`  cd ${outDir}`);
  console.log(`  git init && git add . && git commit -m 'bootstrap: ingest existing site'`);
  process.exit(0);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function wp(path) {
  const res = await fetch(WP_URL + path, { headers: { Authorization: auth } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path}: ${res.status} ${res.statusText} ${body.slice(0, 400)}`);
  }
  return await res.json();
}

async function write(rel, data) {
  const p = path.join(outDir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(p, body);
}

function rsyncCmd(remoteRel, localRel) {
  return `rsync -avz -e 'ssh -p ${sgPort}' ${sgUser}@${sgHost}:${remoteRel} ${path.join(outDir, localRel)}`;
}

function run(cmd) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[k] = true;
    } else {
      out[k] = next;
      i++;
    }
  }
  return out;
}
