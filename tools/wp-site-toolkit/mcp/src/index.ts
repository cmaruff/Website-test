#!/usr/bin/env node
/**
 * WordPress MCP server.
 *
 * Talks to a single WordPress site via the core REST API + Application Password.
 * Configure via env vars (in the MCP server registration in claude.ai /
 * Claude Desktop / Claude Code):
 *
 *   WP_URL          https://cairnsadvertising.com.au
 *   WP_USER         charlie@example.com   (WP username or email)
 *   WP_APP_PASSWORD xxxx xxxx xxxx xxxx
 *
 * For multi-site setups, run one instance per site with its own env block.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { WpClient } from "./wp-client.js";

const cfg = {
  url: requireEnv("WP_URL"),
  user: requireEnv("WP_USER"),
  appPassword: requireEnv("WP_APP_PASSWORD"),
};
const wp = new WpClient(cfg);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

const server = new Server(
  { name: "wp-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ---------- Tool registry ----------

const tools = [
  {
    name: "site_info",
    description:
      "Return the connected WordPress site's name, description, home URL, and the authenticated user's roles. Use this to confirm the connection and which site we're acting on before any write.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => ({
      site: await wp.siteInfo(),
      me: await wp.whoAmI(),
    }),
  },

  {
    name: "list_pages",
    description:
      "List pages on the site. Returns id, slug, title, status, and modified date for each. Optionally filter by search query or status. Use before update_page so you have the right id.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search query" },
        status: { type: "string", description: "publish | draft | private | any (default: any)" },
        per_page: { type: "number", description: "Default 50, max 100" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const argsP = z
        .object({
          search: z.string().optional(),
          status: z.string().optional(),
          per_page: z.number().int().min(1).max(100).optional(),
        })
        .parse(args ?? {});
      const pages = await wp.listPages({ ...argsP, status: argsP.status ?? "any" });
      return pages.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title?.rendered,
        status: p.status,
        modified: p.modified,
        link: p.link,
      }));
    },
  },

  {
    name: "get_page",
    description:
      "Get a single page by id, including raw title, raw content (HTML), excerpt, and meta. Returns the editable raw fields, not the rendered ones.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "number" } },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const { id } = z.object({ id: z.number().int() }).parse(args);
      const p = await wp.getPage(id);
      return {
        id: p.id,
        slug: p.slug,
        status: p.status,
        title_raw: p.title?.raw,
        content_raw: p.content?.raw,
        excerpt_raw: p.excerpt?.raw,
        meta: p.meta,
        modified: p.modified,
        link: p.link,
      };
    },
  },

  {
    name: "update_page",
    description:
      "Update a page. Pass any subset of: title, content (HTML), excerpt, status, meta. Returns the updated page summary. Always preview the proposed content to the user before calling this — writes are immediate.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number" },
        title: { type: "string" },
        content: { type: "string", description: "HTML body" },
        excerpt: { type: "string" },
        status: { type: "string", description: "publish | draft | private" },
        meta: { type: "object", description: "Custom field updates (postmeta)" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const a = z
        .object({
          id: z.number().int(),
          title: z.string().optional(),
          content: z.string().optional(),
          excerpt: z.string().optional(),
          status: z.string().optional(),
          meta: z.record(z.unknown()).optional(),
        })
        .parse(args);
      const { id, ...payload } = a;
      const updated = await wp.updatePage(id, payload);
      return {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        title: updated.title?.rendered,
        modified: updated.modified,
      };
    },
  },

  {
    name: "list_posts",
    description: "List blog posts. Same shape as list_pages.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        status: { type: "string" },
        per_page: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const a = z
        .object({
          search: z.string().optional(),
          status: z.string().optional(),
          per_page: z.number().int().min(1).max(100).optional(),
        })
        .parse(args ?? {});
      const posts = await wp.listPosts({ ...a, status: a.status ?? "any" });
      return posts.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title?.rendered,
        status: p.status,
        modified: p.modified,
        link: p.link,
      }));
    },
  },

  {
    name: "get_post",
    description: "Get a single blog post by id (raw fields).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "number" } },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const { id } = z.object({ id: z.number().int() }).parse(args);
      const p = await wp.getPost(id);
      return {
        id: p.id,
        slug: p.slug,
        status: p.status,
        title_raw: p.title?.raw,
        content_raw: p.content?.raw,
        excerpt_raw: p.excerpt?.raw,
        meta: p.meta,
        modified: p.modified,
        link: p.link,
      };
    },
  },

  {
    name: "update_post",
    description: "Update a blog post (title / content / excerpt / status / meta).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number" },
        title: { type: "string" },
        content: { type: "string" },
        excerpt: { type: "string" },
        status: { type: "string" },
        meta: { type: "object" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const a = z
        .object({
          id: z.number().int(),
          title: z.string().optional(),
          content: z.string().optional(),
          excerpt: z.string().optional(),
          status: z.string().optional(),
          meta: z.record(z.unknown()).optional(),
        })
        .parse(args);
      const { id, ...payload } = a;
      const updated = await wp.updatePost(id, payload);
      return {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        title: updated.title?.rendered,
        modified: updated.modified,
      };
    },
  },

  {
    name: "create_post",
    description:
      "Create a new blog post. Default status is `draft` so it doesn't go live until reviewed. Pass status: 'publish' to publish immediately.",
    inputSchema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        excerpt: { type: "string" },
        status: { type: "string", description: "Default: draft" },
        slug: { type: "string" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const a = z
        .object({
          title: z.string(),
          content: z.string(),
          excerpt: z.string().optional(),
          status: z.string().default("draft"),
          slug: z.string().optional(),
        })
        .parse(args);
      const created = await wp.createPost(a);
      return {
        id: created.id,
        slug: created.slug,
        status: created.status,
        link: created.link,
      };
    },
  },

  {
    name: "list_media",
    description: "List media library items. Returns id, alt text, source URL, and mime type.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        per_page: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const a = z
        .object({
          search: z.string().optional(),
          per_page: z.number().int().min(1).max(100).optional(),
        })
        .parse(args ?? {});
      const media = await wp.listMedia(a);
      return media.map((m: any) => ({
        id: m.id,
        alt: m.alt_text,
        title: m.title?.rendered,
        source_url: m.source_url,
        mime_type: m.mime_type,
      }));
    },
  },

  {
    name: "list_menus",
    description: "List nav menus and their items. Useful before editing site navigation.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const menus = await wp.listMenus();
      const enriched = await Promise.all(
        menus.map(async (m: any) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          locations: m.locations,
          items: await wp.listMenuItems(m.id),
        }))
      );
      return enriched;
    },
  },

  {
    name: "get_elementor_template",
    description:
      "Fetch the Elementor JSON for a page or template by id. Use this when proposing layout-level changes that need to round-trip through Elementor's serialised data.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "number" } },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      const { id } = z.object({ id: z.number().int() }).parse(args);
      return await wp.getElementorTemplate(id);
    },
  },
];

// ---------- MCP wiring ----------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
  try {
    const result = await tool.handler(req.params.arguments ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e: any) {
    return {
      isError: true,
      content: [{ type: "text", text: e?.message ?? String(e) }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`wp-mcp connected to ${cfg.url} as ${cfg.user}`);
