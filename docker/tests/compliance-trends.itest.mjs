/**
 * compliance-trends.itest.mjs — GRC Pulse Executive Summary trends data path.
 *
 * Guards the exact flow the Executive Summary page runs in the browser:
 *     GET /api/compliance/trends?period=3m|6m|12m
 *
 * That endpoint calls createAutoSnapshot(), which issues
 *     INSERT OR REPLACE INTO compliance_snapshots ...
 *     INSERT OR REPLACE INTO domain_snapshots ...
 *     INSERT OR REPLACE INTO risk_snapshots ...
 *     INSERT OR IGNORE  INTO organization_frameworks ...
 * — SQLite/D1 syntax that PostgreSQL rejects with:
 *       syntax error at or near "OR"
 * On the on-prem PostgreSQL path the endpoint therefore 500'd, and the
 * Executive Summary page showed: "Failed to load data: Failed to load
 * compliance trends".
 *
 * The D1->PG runtime adapter (docker/shared/d1-pg-adapter.mjs) now rewrites
 * INSERT OR REPLACE / INSERT OR IGNORE into ON CONFLICT upserts via
 * translateInsertOr(). This test fails (500 / missing chartData) if that
 * translation ever regresses.
 *
 * Self-skips when the GRC stack is unreachable (keeps unit-only CI green).
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { loginGrc, stackUp, GRC_BASE_URL } from './helpers/http.mjs'

let up = false
before(async () => { up = await stackUp(GRC_BASE_URL) })

const PERIODS = ['3m', '6m', '12m']

test('compliance trends: every period returns 200 with chartData (no INSERT OR 500)', async (t) => {
  if (!up) return t.skip('GRC stack not reachable')
  const { client } = await loginGrc()

  for (const period of PERIODS) {
    const res = await client.get('/api/compliance/trends?period=' + period)

    // Historical bug returned 500 with body
    //   {"error":"Failed to load compliance trends","details":"error: syntax error at or near \"OR\""}
    assert.equal(res.status, 200,
      `trends period=${period} should be 200, got ${res.status} (body: ${
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data)})`)

    // Must be parsed JSON, never a raw error string / HTML.
    assert.ok(res.data && typeof res.data === 'object' && !Array.isArray(res.data),
      `trends period=${period} must be a JSON object`)
    assert.equal(res.data.error, undefined,
      `trends period=${period} must not carry an error field (${res.data.error})`)

    // chartData drives the Executive Summary charts.
    assert.ok(res.data.chartData && typeof res.data.chartData === 'object',
      `trends period=${period} must include chartData`)
    assert.equal(res.data.period, period, 'echoed period should match request')

    // compliance series must expose Chart.js-shaped labels + datasets.
    const compliance = res.data.chartData.compliance
    assert.ok(compliance && Array.isArray(compliance.labels),
      `trends period=${period} chartData.compliance.labels must be an array`)
    assert.ok(Array.isArray(compliance.datasets),
      `trends period=${period} chartData.compliance.datasets must be an array`)
  }
})

test('compliance trends: repeated call is stable (auto-snapshot upsert is idempotent)', async (t) => {
  if (!up) return t.skip('GRC stack not reachable')
  const { client } = await loginGrc()

  // createAutoSnapshot runs on every call; calling twice in a row must not
  // error on the ON CONFLICT upsert path.
  const first = await client.get('/api/compliance/trends?period=6m')
  const second = await client.get('/api/compliance/trends?period=6m')
  assert.equal(first.status, 200, 'first trends call should be 200')
  assert.equal(second.status, 200, 'second trends call (re-snapshot) should be 200')
})
