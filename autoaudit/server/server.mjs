/**
 * AutoAudit - Node.js / Docker server entrypoint
 * ===============================================
 * Serves the built React SPA (dist/) and re-implements the Cloudflare Pages
 * Functions (/api/chat, /api/session, /api/policy-session,
 * /api/consultant-session) on Node using the PostgreSQL + AI adapters.
 *
 * The original Cloudflare functions/ directory is left intact for production.
 */

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createD1Adapter, waitForDatabase } from './shared/d1-pg-adapter.mjs'
import { createAIAdapter } from './shared/ai-adapter.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const PORT = parseInt(process.env.PORT || '3000', 10)
const SCHEMA = process.env.DB_SCHEMA || 'autoaudit'
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://grc:grc@postgres:5432/grc_suite'

const MODEL = '@cf/meta/llama-3.1-8b-instruct'

async function main() {
  console.log('[autoaudit] waiting for database...')
  await waitForDatabase(DATABASE_URL)
  const DB = createD1Adapter({ connectionString: DATABASE_URL, schema: SCHEMA })
  const AI = createAIAdapter()

  const app = new Hono()
  app.use('/api/*', cors())

  // ---- /api/chat ---------------------------------------------------------
  app.post('/api/chat', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const userMessage = body?.messages?.[0]?.content || ''
    if (!userMessage) return c.json({ error: 'No message provided' }, 400)

    const isJsonRequest =
      userMessage.includes('Output ONLY this JSON') ||
      userMessage.includes('Respond with ONLY a raw JSON') ||
      userMessage.includes('SANS Institute template') ||
      userMessage.includes('Output ONLY the JSON') ||
      userMessage.includes('Start with { and end with }')

    const hasArabic = /[\u0600-\u06FF]/.test(userMessage)
    const responseLanguage = hasArabic ? 'Arabic' : 'English'
    const systemPrompt = isJsonRequest
      ? 'You are a professional information security policy writer. Output ONLY a valid JSON object, starting with { and ending with }. No markdown, no comments.'
      : `You are AutoAudit, an expert cybersecurity GRC AI agent specializing in ISO 27001, NIST CSF, PCI-DSS, GDPR, and SOC 2. You MUST respond in ${responseLanguage} only. Give concise, expert, practical answers.`

    try {
      const ai = await AI.run(MODEL, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: isJsonRequest ? 4096 : 2048,
        temperature: isJsonRequest ? 0.1 : 0.3,
      })
      return c.json({ content: [{ type: 'text', text: ai.response || '' }], model: MODEL })
    } catch (err) {
      return c.json({ error: err.message || 'AI error' }, 500)
    }
  })

  // ---- /api/session (Gap Analysis) --------------------------------------
  app.get('/api/session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing session id' }, 400)
    const session = await DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()
    if (!session) return c.json({ ok: true, session: null })
    const results = await DB.prepare(
      'SELECT ctrl_id,ctrl_name,verdict,finding,recommendation FROM gap_results WHERE session_id=? ORDER BY id ASC',
    ).bind(id).all()
    const messages = await DB.prepare(
      'SELECT role,msg_text,control_id,control_name,verdict,file_name,is_status FROM chat_messages WHERE session_id=? ORDER BY id ASC',
    ).bind(id).all()
    return c.json({ ok: true, session, results: results.results || [], messages: messages.results || [] })
  })

  app.post('/api/session', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ ok: false, error: 'Invalid JSON' }, 400)
    const { action } = body
    try {
      if (action === 'create') {
        const { id, org_name, industry, size, lang } = body
        if (!id || !org_name) return c.json({ ok: false, error: 'Missing id or org_name' }, 400)
        await DB.prepare(
          `INSERT INTO sessions (id, org_name, industry, size, lang, phase, ctrl_idx)
           VALUES (?, ?, ?, ?, ?, 'idle', 0)
           ON CONFLICT(id) DO UPDATE SET org_name=excluded.org_name, industry=excluded.industry,
             size=excluded.size, lang=excluded.lang, phase='idle', ctrl_idx=0, updated_at=now()`,
        ).bind(id, org_name, industry || '', size || '', lang || 'en').run()
        return c.json({ ok: true, id })
      }
      if (action === 'update') {
        const { id, phase, ctrl_idx } = body
        if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
        await DB.prepare('UPDATE sessions SET phase=?, ctrl_idx=?, updated_at=now() WHERE id=?')
          .bind(phase ?? 'idle', ctrl_idx ?? 0, id).run()
        return c.json({ ok: true })
      }
      if (action === 'result') {
        const { session_id, ctrl_id, ctrl_name, verdict, finding, recommendation } = body
        if (!session_id || !ctrl_id) return c.json({ ok: false, error: 'Missing session_id or ctrl_id' }, 400)
        await DB.prepare(
          `INSERT INTO gap_results (session_id, ctrl_id, ctrl_name, verdict, finding, recommendation)
           VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        ).bind(session_id, ctrl_id, ctrl_name, verdict, finding || '', recommendation || '').run()
        return c.json({ ok: true })
      }
      if (action === 'message') {
        const { session_id, role, msg_text, control_id, control_name, verdict, file_name, is_status } = body
        if (!session_id || !role || !msg_text) return c.json({ ok: false, error: 'Missing fields' }, 400)
        if (is_status) return c.json({ ok: true })
        await DB.prepare(
          `INSERT INTO chat_messages (session_id, role, msg_text, control_id, control_name, verdict, file_name, is_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(session_id, role, msg_text, control_id || null, control_name || null, verdict || null, file_name || null, is_status ? 1 : 0).run()
        return c.json({ ok: true })
      }
      return c.json({ ok: false, error: 'Unknown action: ' + action }, 400)
    } catch (e) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  app.delete('/api/session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing session id' }, 400)
    await DB.prepare('DELETE FROM sessions WHERE id=?').bind(id).run()
    return c.json({ ok: true, deleted: true })
  })

  // ---- /api/policy-session ----------------------------------------------
  app.get('/api/policy-session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
    const row = await DB.prepare('SELECT * FROM policy_sessions WHERE id = ?').bind(id).first()
    if (!row) return c.json({ ok: true, session: null })
    let policy = null
    try { policy = JSON.parse(row.policy_json) } catch {}
    return c.json({ ok: true, session: { ...row, policy } })
  })

  app.post('/api/policy-session', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || body.action !== 'save') return c.json({ ok: false, error: 'Unknown action' }, 400)
    const { id, org_name, industry, size, framework, policy_type, policy_ref, policy, lang } = body
    if (!id || !org_name || !policy) return c.json({ ok: false, error: 'Missing required fields' }, 400)
    await DB.prepare(
      `INSERT INTO policy_sessions (id, org_name, industry, size, framework, policy_type, policy_ref, policy_json, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET org_name=excluded.org_name, industry=excluded.industry,
         size=excluded.size, framework=excluded.framework, policy_type=excluded.policy_type,
         policy_ref=excluded.policy_ref, policy_json=excluded.policy_json, lang=excluded.lang, updated_at=now()`,
    ).bind(id, org_name, industry, size, framework, policy_type, policy_ref || '', JSON.stringify(policy), lang || 'en').run()
    return c.json({ ok: true, id })
  })

  app.delete('/api/policy-session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
    await DB.prepare('DELETE FROM policy_sessions WHERE id=?').bind(id).run()
    return c.json({ ok: true, deleted: true })
  })

  // ---- /api/consultant-session ------------------------------------------
  app.get('/api/consultant-session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
    const session = await DB.prepare('SELECT * FROM consultant_sessions WHERE id = ?').bind(id).first()
    if (!session) return c.json({ ok: true, session: null })
    const messages = await DB.prepare(
      'SELECT role, msg_text FROM consultant_messages WHERE session_id = ? ORDER BY id ASC',
    ).bind(id).all()
    return c.json({ ok: true, session, messages: messages.results || [] })
  })

  app.post('/api/consultant-session', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ ok: false, error: 'Invalid JSON' }, 400)
    const { action } = body
    if (action === 'create') {
      const { id, org, industry, lang } = body
      if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
      await DB.prepare(
        `INSERT INTO consultant_sessions (id, org, industry, lang) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET org=excluded.org, industry=excluded.industry, lang=excluded.lang, updated_at=now()`,
      ).bind(id, org || '', industry || '', lang || 'en').run()
      return c.json({ ok: true, id })
    }
    if (action === 'update_context') {
      const { id, org, industry } = body
      if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
      await DB.prepare('UPDATE consultant_sessions SET org=?, industry=?, updated_at=now() WHERE id=?')
        .bind(org || '', industry || '', id).run()
      return c.json({ ok: true })
    }
    if (action === 'message') {
      const { session_id, role, msg_text } = body
      if (!session_id || !role || !msg_text) return c.json({ ok: false, error: 'Missing fields' }, 400)
      await DB.prepare('INSERT INTO consultant_messages (session_id, role, msg_text) VALUES (?, ?, ?)')
        .bind(session_id, role, msg_text).run()
      return c.json({ ok: true })
    }
    return c.json({ ok: false, error: 'Unknown action: ' + action }, 400)
  })

  app.delete('/api/consultant-session', async (c) => {
    const id = c.req.query('id')
    if (!id) return c.json({ ok: false, error: 'Missing id' }, 400)
    await DB.prepare('DELETE FROM consultant_sessions WHERE id=?').bind(id).run()
    return c.json({ ok: true, deleted: true })
  })

  app.get('/healthz', (c) => c.json({ status: 'ok', service: 'autoaudit' }))

  // ---- Static SPA (Vite build output) -----------------------------------
  const distDir = path.join(PROJECT_ROOT, 'dist')
  if (existsSync(distDir)) {
    const rel = path.relative(process.cwd(), distDir) || '.'
    app.use('/*', serveStatic({ root: rel }))
    // SPA fallback to index.html
    app.get('*', async (c) => {
      const html = await readFile(path.join(distDir, 'index.html'), 'utf-8').catch(() => null)
      if (html) return c.html(html)
      return c.text('AutoAudit build not found. Run `npm run build`.', 404)
    })
  }

  serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
    console.log(`[autoaudit] listening on http://0.0.0.0:${info.port} (schema=${SCHEMA})`)
  })
}

main().catch((err) => {
  console.error('[autoaudit] fatal:', err)
  process.exit(1)
})
