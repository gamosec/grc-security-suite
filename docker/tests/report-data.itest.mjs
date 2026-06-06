/**
 * report-data.itest.mjs — Pentest Pulse report-generation data path.
 *
 * Guards the exact flow the report preview page (/reports/preview/:projectId)
 * runs in the browser:
 *     GET /api/projects/:id
 *     GET /api/findings-with-evidence?project_id=:id
 *
 * The second call SELECTs evidence_files.data_url. That column is created at
 * runtime in the Cloudflare/D1 production DB but is absent from any committed
 * migration, so on the on-prem PostgreSQL path the endpoint used to 500 with a
 * plain-text "Internal Server Error" — which the frontend then tried to
 * JSON.parse, producing: Unexpected token 'I', "Internal S"... is not valid JSON.
 *
 * convert_migrations.py now adds evidence_files.data_url as an idempotent
 * compat column. This test fails (500 / non-array) if that column ever goes
 * missing again.
 *
 * Self-skips when the Pentest stack is unreachable (keeps unit-only CI green).
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { loginPentest, stackUp, PENTEST_BASE_URL } from './helpers/http.mjs'

let up = false
before(async () => { up = await stackUp(PENTEST_BASE_URL) })

test('report data: a defined project returns valid JSON (no 500, no Internal Server Error)', async (t) => {
  if (!up) return t.skip('Pentest stack not reachable')
  const { client } = await loginPentest()

  // Pick a real project the way the UI does (first one in the list).
  const projects = await client.get('/api/projects')
  assert.equal(projects.status, 200, 'projects list should be 200')
  assert.ok(Array.isArray(projects.data) && projects.data.length > 0,
    'expected at least one project to generate a report from')
  const projectId = projects.data[0].id

  // 1) Project lookup (preview page call #1).
  const project = await client.get('/api/projects/' + projectId)
  assert.equal(project.status, 200, 'project lookup should be 200')
  assert.equal(project.data.id, projectId)

  // 2) Findings-with-evidence (preview page call #2 — the one that 500'd).
  const findings = await client.get(
    '/api/findings-with-evidence?project_id=' + encodeURIComponent(projectId))

  // The historical bug returned status 500 with the body "Internal Server Error",
  // so assert BOTH the status and that we got parsed JSON (an array), not a
  // raw error string that would have broken JSON.parse in the browser.
  assert.equal(findings.status, 200,
    `findings-with-evidence should be 200, got ${findings.status} (body: ${
      typeof findings.data === 'string' ? findings.data : JSON.stringify(findings.data)})`)
  assert.ok(Array.isArray(findings.data),
    'response must be a JSON array (the report renderer calls .filter/.map on it)')

  // Each finding must carry an evidence_files array — the report template reads
  // f.evidence_files.length and maps over it. The SELECT includes data_url, so a
  // successful array here also proves the compat column exists.
  for (const f of findings.data) {
    assert.ok(Array.isArray(f.evidence_files),
      `finding ${f.id} should expose an evidence_files array`)
  }
})

test('report data: preview page itself renders (HTTP 200 HTML)', async (t) => {
  if (!up) return t.skip('Pentest stack not reachable')
  const { client } = await loginPentest()
  const projects = await client.get('/api/projects')
  const projectId = projects.data[0].id
  const page = await client.get('/reports/preview/' + projectId)
  assert.equal(page.status, 200, 'preview page should return 200 HTML')
})
