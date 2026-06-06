/**
 * Cloudflare Pages Function — /api/session
 * Handles all Gap Analysis session persistence via D1 SQLite
 *
 * GET    /api/session?id=xxx          → load full session (org, results, messages)
 * POST   /api/session                 → create session          body: {action:"create", ...}
 * POST   /api/session                 → update phase/ctrl_idx   body: {action:"update", ...}
 * POST   /api/session                 → save one result         body: {action:"result", ...}
 * POST   /api/session                 → save one message        body: {action:"message", ...}
 * DELETE /api/session?id=xxx          → delete session + cascade
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(data)  { return new Response(JSON.stringify({ ok:true,  ...data }), { status:200, headers:CORS }); }
function err(msg, status=400) { return new Response(JSON.stringify({ ok:false, error:msg }), { status, headers:CORS }); }

// ── GET — load full session ──────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing session id");

  try {
    const session = await env.DB.prepare(
      "SELECT * FROM sessions WHERE id = ?"
    ).bind(id).first();

    if (!session) return ok({ session: null });

    const results = await env.DB.prepare(
      "SELECT ctrl_id,ctrl_name,verdict,finding,recommendation FROM gap_results WHERE session_id=? ORDER BY id ASC"
    ).bind(id).all();

    const messages = await env.DB.prepare(
      "SELECT role,msg_text,control_id,control_name,verdict,file_name,is_status FROM chat_messages WHERE session_id=? ORDER BY id ASC"
    ).bind(id).all();

    return ok({
      session,
      results:  results.results  || [],
      messages: messages.results || [],
    });
  } catch (e) {
    return err(e.message, 500);
  }
}

// ── POST — create / update / save result / save message ─────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }

  const { action } = body;

  try {
    // ── CREATE session ───────────────────────────────────────────────────────
    if (action === "create") {
      const { id, org_name, industry, size, lang } = body;
      if (!id || !org_name) return err("Missing id or org_name");

      await env.DB.prepare(`
        INSERT INTO sessions (id, org_name, industry, size, lang, phase, ctrl_idx)
        VALUES (?, ?, ?, ?, ?, 'idle', 0)
        ON CONFLICT(id) DO UPDATE SET
          org_name=excluded.org_name, industry=excluded.industry,
          size=excluded.size, lang=excluded.lang,
          phase='idle', ctrl_idx=0, updated_at=CURRENT_TIMESTAMP
      `).bind(id, org_name, industry || "", size || "", lang || "en").run();

      return ok({ id });
    }

    // ── UPDATE phase / ctrl_idx ──────────────────────────────────────────────
    if (action === "update") {
      const { id, phase, ctrl_idx } = body;
      if (!id) return err("Missing id");

      await env.DB.prepare(`
        UPDATE sessions SET phase=?, ctrl_idx=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(phase ?? "idle", ctrl_idx ?? 0, id).run();

      return ok({});
    }

    // ── SAVE one control result ──────────────────────────────────────────────
    if (action === "result") {
      const { session_id, ctrl_id, ctrl_name, verdict, finding, recommendation } = body;
      if (!session_id || !ctrl_id) return err("Missing session_id or ctrl_id");

      // Upsert — avoid duplicates if same control re-assessed
      await env.DB.prepare(`
        INSERT INTO gap_results (session_id, ctrl_id, ctrl_name, verdict, finding, recommendation)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `).bind(session_id, ctrl_id, ctrl_name, verdict, finding || "", recommendation || "").run();

      return ok({});
    }

    // ── SAVE one chat message ────────────────────────────────────────────────
    if (action === "message") {
      const { session_id, role, msg_text, control_id, control_name, verdict, file_name, is_status } = body;
      if (!session_id || !role || !msg_text) return err("Missing required message fields");

      // Don't persist ephemeral status messages ("Evaluating...")
      if (is_status) return ok({});

      await env.DB.prepare(`
        INSERT INTO chat_messages (session_id, role, msg_text, control_id, control_name, verdict, file_name, is_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        session_id, role, msg_text,
        control_id || null, control_name || null,
        verdict || null, file_name || null,
        is_status ? 1 : 0
      ).run();

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
  if (!id) return err("Missing session id");

  try {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
    return ok({ deleted: true });
  } catch (e) {
    return err(e.message, 500);
  }
}

// ── OPTIONS — CORS preflight ─────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status:204, headers:CORS });
}
