// Cloudflare Worker — proxies terminal logs to Discord webhooks.
//
// Supports two event types:
//   { "type": "sudo", "cmd": "sudo rm -rf /" }   -> DISCORD_WEBHOOK_URL_SUDO
//   { "type": "cmd",  "cmd": "help" }            -> DISCORD_WEBHOOK_URL_CMD
//
// Deploy:
//   1. wrangler deploy worker/sudo-log.js --name trent-term-log
//   2. wrangler secret put DISCORD_WEBHOOK_URL_SUDO
//   3. wrangler secret put DISCORD_WEBHOOK_URL_CMD
//   4. (optional) wrangler secret put SHARED_TOKEN  # any random string

const ALLOWED_ORIGINS = new Set([
  "https://trent-buckley.com",
  "https://www.trent-buckley.com",
]);

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT_PER_MIN = 20; // per IP

// In-memory bucket per worker isolate. Not global, but good enough for casual abuse.
const buckets = new Map();

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://trent-buckley.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (buckets.get(ip) || []).filter((t) => t > windowStart);
  hits.push(now);
  buckets.set(ip, hits);
  return hits.length > RATE_LIMIT_PER_MIN;
}

function clip(s, n) {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function escapeBackticks(s) {
  return s.replace(/`/g, "ˋ");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405, headers: cors });
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response("forbidden", { status: 403, headers: cors });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    if (rateLimited(ip)) {
      return new Response("rate limited", { status: 429, headers: cors });
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return new Response("payload too large", { status: 413, headers: cors });
      }
      body = JSON.parse(raw);
    } catch {
      return new Response("bad json", { status: 400, headers: cors });
    }

    if (env.SHARED_TOKEN && body.token !== env.SHARED_TOKEN) {
      return new Response("unauthorized", { status: 401, headers: cors });
    }

    const type = body.type === "sudo" ? "sudo" : "cmd";
    const webhookUrl = type === "sudo" ? env.DISCORD_WEBHOOK_URL_SUDO : env.DISCORD_WEBHOOK_URL_CMD;
    if (!webhookUrl) {
      return new Response("misconfigured", { status: 500, headers: cors });
    }

    const cmd = clip(body.cmd, 500);
    const ua = clip(request.headers.get("User-Agent") || "?", 200);
    const referrer = clip(body.referrer || request.headers.get("Referer") || "direct", 200);
    const country = request.cf?.country || "?";

    const lines = type === "sudo"
      ? [
          "**sudo attempt**",
          "`" + escapeBackticks(cmd) + "`",
          "ip: `" + ip + "` (" + country + ")",
          "ua: `" + ua + "`",
          "referrer: `" + referrer + "`",
          "time: " + new Date().toISOString(),
        ]
      : [
          "`" + escapeBackticks(cmd) + "`",
          "ip: `" + ip + "` (" + country + ")",
          "ua: `" + ua + "`",
        ];

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: type === "sudo" ? "sudoers-log" : "cmd-log",
        content: lines.join("\n"),
      }),
    });

    return new Response(discordRes.ok ? "ok" : "upstream error", {
      status: discordRes.ok ? 204 : 502,
      headers: cors,
    });
  },
};
