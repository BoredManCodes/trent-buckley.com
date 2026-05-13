// Cloudflare Worker — proxies terminal logs to Discord webhooks.
//
// Events:
//   { "type": "sudo", "cmd": "sudo rm -rf /" }   -> one-shot to DISCORD_WEBHOOK_URL_SUDO
//   { "type": "cmd",  "cmd": "help", "visitorId": "<uuid>" }
//        -> per-visitor session message via DISCORD_WEBHOOK_URL_CMD, edited in place
//           until ~1800 chars, then a new continuation message is started.
//
// Bindings required (configure in CF dashboard or wrangler.toml):
//   - KV namespace bound as `LOGS`
//   - secret DISCORD_WEBHOOK_URL_SUDO
//   - secret DISCORD_WEBHOOK_URL_CMD
//   - (optional) secret SHARED_TOKEN

const ALLOWED_ORIGINS = new Set([
  "https://trent-buckley.com",
  "https://www.trent-buckley.com",
]);

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT_PER_MIN = 60;          // per IP
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h of inactivity ends the session
const DISCORD_CONTENT_LIMIT = 2000;
const SOFT_LIMIT = 1850;                // leave headroom for the next line

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

function safeVisitorId(s) {
  return String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

async function sendSudo(env, body, request, ip) {
  const cmd = clip(body.cmd, 500);
  const ua = clip(request.headers.get("User-Agent") || "?", 200);
  const referrer = clip(body.referrer || request.headers.get("Referer") || "direct", 200);
  const country = request.cf?.country || "?";

  const content = [
    "**sudo attempt**",
    "`" + escapeBackticks(cmd) + "`",
    "ip: `" + ip + "` (" + country + ")",
    "ua: `" + ua + "`",
    "referrer: `" + referrer + "`",
    "time: " + new Date().toISOString(),
  ].join("\n");

  const res = await fetch(env.DISCORD_WEBHOOK_URL_SUDO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sudoers-log", content }),
  });
  return res;
}

function buildSessionContent(header, lines, cont) {
  const top = cont ? header + " (cont.)" : header;
  return top + "\n```\n" + lines.join("\n") + "\n```";
}

async function sendCmd(env, body, request, ip) {
  const visitorId = safeVisitorId(body.visitorId);
  if (!visitorId) {
    return { ok: false, status: 400, message: "missing visitorId" };
  }
  if (!env.LOGS) {
    return { ok: false, status: 500, message: "misconfigured: missing KV binding LOGS" };
  }

  const cmd = clip(body.cmd, 200);
  const ua = clip(request.headers.get("User-Agent") || "?", 200);
  const country = request.cf?.country || "?";

  const header = [
    "**session** `" + visitorId.slice(0, 8) + "`",
    "ip: `" + ip + "` (" + country + ")",
    "ua: `" + ua + "`",
  ].join("\n");

  const newLine = "> " + escapeBackticks(cmd);

  const key = "v:" + visitorId;
  const stateRaw = await env.LOGS.get(key);
  const state = stateRaw ? JSON.parse(stateRaw) : null;

  // No active session -> POST a new message
  if (!state || !state.messageId) {
    const content = buildSessionContent(header, [newLine], false);
    const res = await fetch(env.DISCORD_WEBHOOK_URL_CMD + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "session", content }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: 502, message: "discord post " + res.status + ": " + txt.slice(0, 200) };
    }
    const msg = await res.json();
    await env.LOGS.put(
      key,
      JSON.stringify({ messageId: msg.id, lines: [newLine], cont: false }),
      { expirationTtl: SESSION_TTL_SECONDS }
    );
    return { ok: true };
  }

  // Try to extend the existing message
  const candidateLines = [...state.lines, newLine];
  const candidateContent = buildSessionContent(header, candidateLines, !!state.cont);

  if (candidateContent.length <= SOFT_LIMIT && candidateContent.length <= DISCORD_CONTENT_LIMIT) {
    const res = await fetch(env.DISCORD_WEBHOOK_URL_CMD + "/messages/" + state.messageId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: candidateContent }),
    });
    if (res.status === 404) {
      // Message was deleted - start fresh
      const newContent = buildSessionContent(header, [newLine], false);
      const postRes = await fetch(env.DISCORD_WEBHOOK_URL_CMD + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "session", content: newContent }),
      });
      if (!postRes.ok) {
        const txt = await postRes.text().catch(() => "");
        return { ok: false, status: 502, message: "discord repost " + postRes.status + ": " + txt.slice(0, 200) };
      }
      const msg = await postRes.json();
      await env.LOGS.put(
        key,
        JSON.stringify({ messageId: msg.id, lines: [newLine], cont: false }),
        { expirationTtl: SESSION_TTL_SECONDS }
      );
      return { ok: true };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: 502, message: "discord patch " + res.status + ": " + txt.slice(0, 200) };
    }
    await env.LOGS.put(
      key,
      JSON.stringify({ messageId: state.messageId, lines: candidateLines, cont: !!state.cont }),
      { expirationTtl: SESSION_TTL_SECONDS }
    );
    return { ok: true };
  }

  // Overflow -> POST continuation
  const content = buildSessionContent(header, [newLine], true);
  const res = await fetch(env.DISCORD_WEBHOOK_URL_CMD + "?wait=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "session", content }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: 502, message: "discord cont " + res.status + ": " + txt.slice(0, 200) };
  }
  const msg = await res.json();
  await env.LOGS.put(
    key,
    JSON.stringify({ messageId: msg.id, lines: [newLine], cont: true }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
  return { ok: true };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      if (request.method !== "POST") {
        return new Response("method not allowed", { status: 405, headers: cors });
      }
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response("forbidden: origin " + origin, { status: 403, headers: cors });
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

      if (type === "sudo") {
        if (!env.DISCORD_WEBHOOK_URL_SUDO) {
          return new Response("misconfigured: missing DISCORD_WEBHOOK_URL_SUDO", { status: 500, headers: cors });
        }
        const res = await sendSudo(env, body, request, ip);
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return new Response("upstream " + res.status + ": " + txt.slice(0, 200), { status: 502, headers: cors });
        }
        return new Response(null, { status: 204, headers: cors });
      }

      // type === "cmd"
      if (!env.DISCORD_WEBHOOK_URL_CMD) {
        return new Response("misconfigured: missing DISCORD_WEBHOOK_URL_CMD", { status: 500, headers: cors });
      }
      const result = await sendCmd(env, body, request, ip);
      if (!result.ok) {
        return new Response(result.message, { status: result.status, headers: cors });
      }
      return new Response(null, { status: 204, headers: cors });
    } catch (e) {
      return new Response("worker error: " + (e && e.message || e), { status: 500, headers: cors });
    }
  },
};
