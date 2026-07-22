/**
 * compliance-score-movement.itest.mjs — GRC Pulse risk-weighted compliance score.
 *
 * Guards the fix for the reported bug:
 *   "the issue for Compliance Score does not effect when changing the status
 *    of finding or risk"
 *
 * Root cause: Pentest sent risk scores on a 1-25 scale (likelihood*impact),
 * but GRC buckets severities on a 0-100 scale (getSeverityFromScore: >=75
 * critical, >=50 high, >=25 medium, <25 low). Synced critical findings
 * arrived as ~25 -> GRC filed them as low/medium -> ~0 penalty -> closing a
 * finding never moved the score.
 *
 * Fix (Weighted Deduction Model, user-approved):
 *   Base = implemented/applicable controls * 100
 *   Deduction = sum per open/in_progress risk by severity
 *               (critical -5, high -3, medium -1, low -0.5),
 *               in_progress at HALF weight, capped at 40
 *   Final = max(0, round(Base - Deduction))
 * Pentest now sends a normalized 0-100 inherent_score keyed off severity
 * (critical 95 / high 75 / medium 50 / low 25) plus pentest_severity.
 *
 * This test opens a critical Pentest finding, re-syncs, and asserts the GRC
 * compliance score DROPS; then closes it, re-syncs, and asserts the score
 * RECOVERS. Delta-based so it is independent of the absolute seed score.
 *
 * Self-skips when either stack is unreachable (keeps unit-only CI green).
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  loginGrc, loginPentest, stackUp, GRC_BASE_URL, PENTEST_BASE_URL,
} from './helpers/http.mjs'

let up = false
before(async () => {
  up = (await stackUp(GRC_BASE_URL)) && (await stackUp(PENTEST_BASE_URL))
})

/** Pull Pentest -> GRC and read the risk-adjusted compliance score. */
async function syncAndScore(grc) {
  const sync = await grc.post('/api/sync/pentest/pull', {})
  assert.equal(sync.status, 200, `pull sync should be 200 (body: ${JSON.stringify(sync.data)})`)
  const dash = await grc.get('/api/dashboard')
  assert.equal(dash.status, 200, 'dashboard should be 200')
  const health = dash.data?.complianceHealth
  assert.ok(health && typeof health.overallScore === 'number',
    `dashboard must expose complianceHealth.overallScore (got ${JSON.stringify(health)})`)
  return health
}

/** Find a critical Pentest finding to toggle. */
async function findCriticalFinding(pt) {
  const res = await pt.get('/api/findings')
  const list = Array.isArray(res.data) ? res.data : (res.data?.findings || res.data?.data || [])
  return list.find(f => (f.severity || '').toLowerCase() === 'critical')
}

test('compliance score moves when a critical finding is opened and closed', async (t) => {
  if (!up) return t.skip('GRC + Pentest stack not reachable')

  const { client: grc } = await loginGrc()
  const { client: pt } = await loginPentest()

  const finding = await findCriticalFinding(pt)
  if (!finding) return t.skip('no critical Pentest finding available to toggle')
  const originalStatus = finding.status

  // Baseline: ensure the finding is closed (remediated) first.
  await pt.patch(`/api/findings/${finding.id}`, { status: 'remediated' })
  const baseline = await syncAndScore(grc)

  // Open the critical finding -> score should DROP (critical = -5).
  const openRes = await pt.patch(`/api/findings/${finding.id}`, { status: 'open' })
  assert.equal(openRes.status, 200, 'reopening finding should be 200')
  const opened = await syncAndScore(grc)

  assert.ok(opened.overallScore < baseline.overallScore,
    `score must DROP after opening a critical finding: baseline=${baseline.overallScore} opened=${opened.overallScore}`)
  assert.ok(opened.riskPenalty > baseline.riskPenalty,
    `riskPenalty must RISE after opening: baseline=${baseline.riskPenalty} opened=${opened.riskPenalty}`)

  // Close it again -> score should RECOVER to the baseline.
  const closeRes = await pt.patch(`/api/findings/${finding.id}`, { status: 'remediated' })
  assert.equal(closeRes.status, 200, 'closing finding should be 200')
  const closed = await syncAndScore(grc)

  assert.equal(closed.overallScore, baseline.overallScore,
    `score must RECOVER after closing: baseline=${baseline.overallScore} closed=${closed.overallScore}`)

  // Restore original seed status so re-runs stay deterministic.
  await pt.patch(`/api/findings/${finding.id}`, { status: originalStatus })
  await grc.post('/api/sync/pentest/pull', {})
})

test('synced pentest risks use the 0-100 severity scale (not raw 1-25)', async (t) => {
  if (!up) return t.skip('GRC + Pentest stack not reachable')
  const { client: pt } = await loginPentest()

  // The external findings endpoint feeds the GRC sync; its inherent_score
  // must be normalized to 0-100 or GRC files everything as low.
  const res = await pt.get('/api/external/findings?org_id=org-001', {
    headers: { 'X-Sync-Key': process.env.SYNC_KEY || 'ci-strong-sync-key-def456uvw' },
  })
  if (res.status !== 200) return t.skip(`external findings not available (${res.status})`)
  const findings = res.data?.findings || []
  if (findings.length === 0) return t.skip('no external findings to assert on')

  const expect = { critical: 95, high: 75, medium: 50, low: 25, informational: 10 }
  for (const f of findings) {
    const sev = (f.severity || '').toLowerCase()
    assert.equal(f.pentest_severity, f.severity, 'pentest_severity must be carried for GRC scoring')
    if (expect[sev] !== undefined) {
      assert.equal(f.inherent_score, expect[sev],
        `finding "${f.title}" sev=${sev} must map to inherent_score=${expect[sev]}, got ${f.inherent_score}`)
    }
  }
})
