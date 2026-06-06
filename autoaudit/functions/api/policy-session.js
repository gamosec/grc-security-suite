/**
 * Cloudflare Pages Function — /api/policy-session
 * Saves and loads generated policy documents via D1
 *
 * GET    /api/policy-session?id=xxx   → load saved policy
 * POST   /api/policy-session          → save policy   body: {action:"save", ...}
 * DELETE /api/policy-session?id=xxx   → delete policy
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(data)         { return new Response(JSON.stringify({ ok:true,  ...data }), { status:200, headers:CORS }); }
function err(msg, s=400)  { return new Response(JSON.stringify({ ok:false, error:msg }), { status:s, headers:CORS }); }

// ── GET — load saved policy ──────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing id");

  try {
    const row = await env.DB.prepare(
      "SELECT * FROM policy_sessions WHERE id = ?"
    ).bind(id).first();

    if (!row) return ok({ session: null });

    // Parse stored JSON back to object
    let policy = null;
    try { policy = JSON.parse(row.policy_json); } catch {}

    return ok({ session: { ...row, policy } });
  } catch (e) {
    return err(e.message, 500);
  }
}

// ── POST — save generated policy ─────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }

  const { action } = body;

  if (action === "save") {
    const { id, org_name, industry, size, framework, policy_type, policy_ref, policy, lang } = body;
    if (!id || !org_name || !policy) return err("Missing required fields");

    try {
      await env.DB.prepare(`
        INSERT INTO policy_sessions (id, org_name, industry, size, framework, policy_type, policy_ref, policy_json, lang)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          org_name=excluded.org_name, industry=excluded.industry,
          size=excluded.size, framework=excluded.framework,
          policy_type=excluded.policy_type, policy_ref=excluded.policy_ref,
          policy_json=excluded.policy_json, lang=excluded.lang,
          updated_at=CURRENT_TIMESTAMP
      `).bind(
        id, org_name, industry, size, framework,
        policy_type, policy_ref || "",
        JSON.stringify(policy), lang || "en"
      ).run();

      return ok({ id });
    } catch (e) {
      return err(e.message, 500);
    }
  }

  return err("Unknown action: " + action);
}

// ── DELETE — clear saved policy ───────────────────────────────────────────────
export async function onRequestDelete(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing id");

  try {
    await env.DB.prepare("DELETE FROM policy_sessions WHERE id=?").bind(id).run();
    return ok({ deleted: true });
  } catch (e) {
    return err(e.message, 500);
  }
}

// ── OPTIONS ───────────────────────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status:204, headers:CORS });
}
