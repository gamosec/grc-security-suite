/**
 * compliance-scoring.itest.mjs — integration test for ISO 27001 compliance
 * scoring (GRC Pulse).
 *
 * Compliance scoring is core GRC business logic, so this asserts it responds
 * correctly and reversibly to control assessments:
 *
 *   1. With no implemented controls the framework score is 0.
 *   2. Implementing N controls raises the `implemented` count by exactly N and
 *      strictly increases the score (monotonic).
 *   3. Reverting those controls to not_started restores the original count and
 *      score (this guards the datetime("now") UPDATE-path bug, where status
 *      downgrades used to silently fail on PostgreSQL).
 *
 * The test fully restores any control it touches, so it is safe to re-run.
 * Runs against a live stack; self-skips if it is not reachable.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { loginGrc, stackUp } from './helpers/http.mjs'

let client
let available = false
const touched = [] // control ids we changed, so we can always restore them

before(async () => {
  available = await stackUp()
  if (available) ({ client } = await loginGrc())
})

after(async () => {
  // Best-effort restore of anything still set, even if a test threw.
  if (!available) return
  for (const id of touched) {
    await client.post('/api/compliance/assessment', {
      control_library_id: id, implementation_status: 'not_started', maturity_level: 0,
    }).catch(() => {})
  }
})

const skipIfDown = (t) => {
  if (!available) {
    t.skip('GRC stack not reachable (docker/scripts/run-local.sh start)')
    return true
  }
  return false
}

/** Read the ISO 27001 framework scoring snapshot from the compliance dashboard. */
async function isoScore() {
  const d = await client.get('/api/compliance/dashboard')
  assert.equal(d.status, 200, `dashboard should 200, got ${d.status}`)
  const f = (d.data.frameworks || []).find((x) => x.code === 'ISO27001')
  assert.ok(f, 'ISO27001 framework present in dashboard')
  return { score: f.score, implemented: f.implemented, total: f.total }
}

async function setStatus(id, status) {
  const r = await client.post('/api/compliance/assessment', {
    control_library_id: id, implementation_status: status, maturity_level: status === 'implemented' ? 3 : 0,
  })
  assert.equal(r.status, 200, `assessment write should 200 for ${id}, got ${r.status}: ${JSON.stringify(r.data)}`)
  if (status !== 'not_started') touched.push(id)
}

test('compliance scoring responds to implemented controls and is reversible', async (t) => {
  if (skipIfDown(t)) return

  // Use real ISO control ids from the library.
  const ctrls = await client.get('/api/compliance/controls')
  assert.equal(ctrls.status, 200)
  const isoIds = (ctrls.data.controls || [])
    .map((c) => c.id)
    .filter((id) => String(id).startsWith('iso-'))
    .slice(0, 5)
  assert.equal(isoIds.length, 5, 'need 5 ISO controls to assess')

  // (1) Baseline.
  const base = await isoScore()
  assert.equal(base.implemented, 0, 'fresh org has no implemented controls')
  assert.equal(base.score, 0, 'no implemented controls -> score 0')

  // (2) Implement 5 -> count rises by exactly 5; score strictly increases.
  for (const id of isoIds) await setStatus(id, 'implemented')
  const up = await isoScore()
  assert.equal(up.implemented, base.implemented + 5, 'implemented count rose by exactly 5')
  assert.ok(up.score > base.score, `score should increase (was ${base.score}, now ${up.score})`)
  assert.equal(up.total, base.total, 'total control count is unchanged')

  // (3) Revert -> count and score return to baseline (guards the UPDATE bug).
  for (const id of isoIds) await setStatus(id, 'not_started')
  const back = await isoScore()
  assert.equal(back.implemented, base.implemented, 'implemented count restored after revert')
  assert.equal(back.score, base.score, 'score restored after revert')
})

test('compliance scoring is monotonic: more implemented never lowers the score', async (t) => {
  if (skipIfDown(t)) return

  const ctrls = await client.get('/api/compliance/controls')
  const isoIds = (ctrls.data.controls || [])
    .map((c) => c.id)
    .filter((id) => String(id).startsWith('iso-'))
    .slice(0, 6)

  let prev = (await isoScore()).score
  for (let i = 0; i < isoIds.length; i++) {
    await setStatus(isoIds[i], 'implemented')
    const cur = (await isoScore()).score
    assert.ok(cur >= prev, `score must not decrease when implementing more (step ${i}: ${prev} -> ${cur})`)
    prev = cur
  }
  // Cleanup handled by the after() hook via `touched`.
})
