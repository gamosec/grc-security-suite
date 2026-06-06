/**
 * auth-hardening.test.mjs
 * =======================
 * Unit tests for the security-critical primitives in
 * docker/shared/auth-hardening.mjs. These run with the Node built-in test
 * runner (`node --test`) and need no database or running server — they cover
 * the pure functions that protect every login:
 *
 *   - bcrypt hashing + verification
 *   - bcrypt hash detection (so we never treat a legacy hash as bcrypt)
 *   - legacy SHA-256 verification + the "upgrade on login" signal
 *   - app-compatible HS256 JWT signing (verified back with WebCrypto)
 *
 * The live login flow (master-password block, cookie issuance, downstream
 * authorization, SHA-256 -> bcrypt upgrade) is covered by the integration
 * smoke test in docker/tests/smoke.sh against a running stack.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  hashPassword,
  isBcryptHash,
  verifyPassword,
  signJWT,
} from '../shared/auth-hardening.mjs'

const sha256Hex = async (input) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

test('hashPassword produces a verifiable bcrypt hash', async () => {
  const hash = await hashPassword('S3cret!Pass')
  assert.ok(isBcryptHash(hash), 'output should be a bcrypt hash')
  const { ok, needsUpgrade } = await verifyPassword('S3cret!Pass', hash)
  assert.equal(ok, true)
  assert.equal(needsUpgrade, false, 'bcrypt hash needs no upgrade')
})

test('verifyPassword rejects a wrong password against bcrypt', async () => {
  const hash = await hashPassword('correct-horse')
  const { ok } = await verifyPassword('battery-staple', hash)
  assert.equal(ok, false)
})

test('isBcryptHash distinguishes bcrypt from SHA-256', async () => {
  const bc = await hashPassword('x')
  const sha = await sha256Hex('x' + 'grc-pulse-salt')
  assert.equal(isBcryptHash(bc), true)
  assert.equal(isBcryptHash(sha), false)
  assert.equal(isBcryptHash(''), false)
  assert.equal(isBcryptHash(null), false)
})

test('verifyPassword accepts a legacy SHA-256 hash and flags upgrade', async () => {
  const salt = 'grc-pulse-salt'
  const legacyHashFn = (pw) => sha256Hex(pw + salt)
  const stored = await sha256Hex('legacy-pw' + salt)
  const { ok, needsUpgrade } = await verifyPassword('legacy-pw', stored, legacyHashFn)
  assert.equal(ok, true)
  assert.equal(needsUpgrade, true, 'legacy hash must signal upgrade-on-login')
})

test('verifyPassword rejects a wrong password against a legacy hash', async () => {
  const salt = 'pentest-pulse-salt-2024'
  const legacyHashFn = (pw) => sha256Hex(pw + salt)
  const stored = await sha256Hex('right' + salt)
  const { ok } = await verifyPassword('wrong', stored, legacyHashFn)
  assert.equal(ok, false)
})

test('signJWT produces a token the app HS256 verifier accepts', async () => {
  const secret = 'unit-test-secret'
  const payload = { userId: 'u1', email: 'a@b.com', role: 'admin', exp: Date.now() + 60_000 }
  const token = await signJWT(payload, secret)
  const [h, p, s] = token.split('.')
  assert.ok(h && p && s, 'token has three segments')

  // Verify the signature the same way the apps do.
  const b64urlToBytes = (str) => {
    const norm = str.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(Buffer.from(norm, 'base64'))
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'HMAC', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
  )
  assert.equal(valid, true, 'signature must verify with the same secret')

  const decoded = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
  assert.equal(decoded.userId, 'u1')
  assert.equal(decoded.role, 'admin')
})

test('signJWT signature changes when the secret changes (no forgery)', async () => {
  const payload = { userId: 'u1', exp: Date.now() + 1000 }
  const a = await signJWT(payload, 'secret-A')
  const b = await signJWT(payload, 'secret-B')
  assert.notEqual(a.split('.')[2], b.split('.')[2], 'different secrets -> different signatures')
})
