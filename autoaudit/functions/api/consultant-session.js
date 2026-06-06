/**
 * Cloudflare Pages Function — /api/consultant-session
 * Persists AI GRC Consultant chat sessions in D1
 *
 * GET    /api/consultant-session?id=xxx   → load session + messages
 * POST   /api/consultant-session          → create/update session or save message
 * DELETE /api/consultant-session?id=xxx   → delete session + cascade
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(data)             { return new Response(JSON.stringify({ ok:true,  ...data }), { status:200, headers:CORS }); }
function err(msg, status=400) { return new Response(JSON.stringify({ ok:false, error:msg }), { status, headers:CORS }); }

// ── GET — load full session + message history ────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing id");

  try {
    const session = await env.DB.prepare(
      "SELECT * FROM consultant_sessions WHERE id = ?"
    ).bind(id).first();

    if (!session) return ok({ session: null });

    const messages = await env.DB.prepare(
      "SELECT role, msg_text FROM consultant_messages WHERE session_id = ? ORDER BY id ASC"
    ).bind(id).all();

    return ok({
      session,
      messages: messages.results || [],
    });
  } catch (e) {
    return err(e.message, 500);
  }
}

// ── POST — create session / update context / save message ────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }

  const { action } = body;

  try {
    // ── CREATE or UPDATE session ─────────────────────────────────────────────
    if (action === "create") {
      const { id, org, industry, lang } = body;
      if (!id) return err("Missing id");

      await env.DB.prepare(`
        INSERT INTO consultant_sessions (id, org, industry, lang)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          org=excluded.org, industry=excluded.industry,
          lang=excluded.lang, updated_at=CURRENT_TIMESTAMP
      `).bind(id, org||"", industry||"", lang||"en").run();

      return ok({ id });
    }

    // ── UPDATE context fields only (org/industry changed mid-chat) ───────────
    if (action === "update_context") {
      const { id, org, industry } = body;
      if (!id) return err("Missing id");

      await env.DB.prepare(`
        UPDATE consultant_sessions SET org=?, industry=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(org||"", industry||"", id).run();

      return ok({});
    }

    // ── SAVE one message ─────────────────────────────────────────────────────
    if (action === "message") {
      const { session_id, role, msg_text } = body;
      if (!session_id || !role || !msg_text) return err("Missing required fields");

      await env.DB.prepare(`
        INSERT INTO consultant_messages (session_id, role, msg_text)
        VALUES (?, ?, ?)
      `).bind(session_id, role, msg_text).run();

      // Keep only last 100 messages per session to avoid bloat
      await env.DB.prepare(`
        DELETE FROM consultant_messages
        WHERE session_id = ?
          AND id NOT IN (
            SELECT id FROM consultant_messages
            WHERE session_id = ?
            ORDER BY id DESC LIMIT 100
          )
      `).bind(session_id, session_id).run();

      return ok({});
    }

    return err("Unknown action: " + action);

  } catch (e) {
    return err(e.message, 500);
  }
}

// ── DELETE — clear session ───────────────────────────────────────────────────
export async function onRequestDelete(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing id");

  try {
    await env.DB.prepare("DELETE FROM consultant_sessions WHERE id=?").bind(id).run();
    return ok({ deleted: true });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status:204, headers:CORS });
}
