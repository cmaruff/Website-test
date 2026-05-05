// ============================================================
// EDGE FUNCTION: monthly-seo-post
// Generates a blog post draft + meta description via Anthropic API,
// stores it in a `posts` table, and pings Google with sitemap URL.
//
// Schedule via Supabase Cron (pg_cron) to run monthly:
//   select cron.schedule(
//     'tq-monthly-seo',
//     '0 9 1 * *',   -- 9am on the 1st each month
//     $$ select net.http_post(
//          url := 'https://YOUR-PROJECT.supabase.co/functions/v1/monthly-seo-post',
//          headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
//        ) $$
//   );
//
// Required env vars:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PUBLIC_SITE_URL
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEO_TOPICS = [
  "How often should you service your pool in tropical North Queensland?",
  "Why do Townsville pools turn green so fast in summer?",
  "Saltwater vs chlorine pools — what works best for NQ humidity?",
  "Pre-wet-season pool prep: a Townsville checklist",
  "Cyclone-season pool care: what to do before and after",
  "Why pool chemistry shifts more in the tropics",
  "Pool cover or no cover in Townsville? A real-world comparison",
  "When to replace your pool pump: signs Townsville owners often miss",
  "Mineral salt vs traditional chlorination explained",
  "Algae bloom recovery: what a green pool actually costs",
  "Holiday pool care while you're away from Townsville",
  "Is your chlorinator cell on the way out? Three quick tests",
];

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pick a topic that hasn't been used recently
    const { data: recent } = await supabase
      .from("posts")
      .select("topic")
      .order("created_at", { ascending: false })
      .limit(6);
    const used = new Set((recent ?? []).map(r => r.topic));
    const candidates = SEO_TOPICS.filter(t => !used.has(t));
    const topic = candidates[Math.floor(Math.random() * candidates.length)] ?? SEO_TOPICS[0];

    // Call Anthropic
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const prompt = `Write an SEO blog post for TQ Pool Services, a mobile pool service business in Townsville, North Queensland.

Topic: "${topic}"

Requirements:
- 600-800 words
- Conversational, helpful tone — no AI-sounding openers or "in today's fast-paced world" clichés
- Practical, locally-relevant (mention Townsville/NQ climate considerations where appropriate)
- Include 3-4 H2 subheadings
- End with a soft CTA to book a service or call
- Output as Markdown

After the article, on a new line, output the JSON:
{
  "seo_title": "...",         // <60 chars, primary keyword first
  "seo_description": "...",   // <160 chars, includes "Townsville" once
  "slug": "kebab-case-url-slug"
}`;

    const aRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aRes.ok) throw new Error(`Anthropic API: ${await aRes.text()}`);
    const aData = await aRes.json();
    const fullText = aData.content[0].text as string;

    // Split body / metadata
    const jsonMatch = fullText.match(/\{[\s\S]*"slug"[\s\S]*\}/);
    let meta: any = {};
    let body = fullText;
    if (jsonMatch) {
      try {
        meta = JSON.parse(jsonMatch[0]);
        body = fullText.replace(jsonMatch[0], "").trim();
      } catch {}
    }

    // Save draft
    await supabase.from("posts").insert({
      topic,
      title: meta.seo_title ?? topic,
      slug: meta.slug ?? slugify(topic),
      seo_description: meta.seo_description,
      body_md: body,
      status: "draft",  // admin reviews before publishing
    });

    return new Response(JSON.stringify({ ok: true, topic }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("monthly-seo-post error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
