/**
 * Bundles the existing Hono app (src/index.tsx) into a single Node ESM module
 * (dist-server/app.mjs) using esbuild. The original Cloudflare build is not
 * touched. A tiny alias plugin replaces Cloudflare-only modules with
 * Node-compatible shims so the application source stays unchanged.
 */
import esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Replace `hono/cloudflare-pages` (serveStatic for CF) with a no-op shim that
// is compatible at the module level. Static files are served by server.mjs.
const cloudflareShim = {
  name: 'cloudflare-pages-shim',
  setup(build) {
    build.onResolve({ filter: /^hono\/cloudflare-pages$/ }, () => ({
      path: path.join(__dirname, 'shims', 'cloudflare-pages.mjs'),
    }))
  },
}

// On-prem cross-system sync URL rewrite.
// In production GRC Pulse calls Pentest Pulse at a hardcoded *.pages.dev URL.
// For the Docker/on-prem stack the peer runs at a different host, so we rewrite
// the hardcoded URL string at BUNDLE TIME (the on-disk source is never
// modified, so the Cloudflare build keeps the production URL). The replacement
// is driven by PENTEST_PULSE_URL with the production value as the default.
const PENTEST_PULSE_URL = process.env.PENTEST_PULSE_URL || 'https://pentest-pulse.pages.dev'

// On-prem auth hardening: the application source hardcodes the JWT signing
// secret and the cross-system sync key. The server's hardened login
// (auth-hardening.mjs) signs sessions with JWT_SECRET, so the app's verifier
// must use the SAME secret — otherwise every request 401s. Likewise the sync
// key the server expects must match the key the app sends. We rewrite both
// hardcoded strings at BUNDLE TIME from env vars, leaving the on-disk source
// (and therefore the Cloudflare production build) byte-for-byte unchanged.
// Defaults are the production values so an env-less build reproduces prod.
const PROD_JWT_SECRET = 'grc-pulse-jwt-v5-2026'
const PROD_SYNC_KEY = 'grcpulse-sync-2024'
const JWT_SECRET = process.env.JWT_SECRET || PROD_JWT_SECRET
const SYNC_KEY = process.env.SYNC_KEY || PROD_SYNC_KEY

const syncUrlRewrite = {
  name: 'sync-url-rewrite',
  setup(build) {
    build.onLoad({ filter: /src[\\/]index\.tsx$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8')
      contents = contents.split('https://pentest-pulse.pages.dev').join(PENTEST_PULSE_URL)
      // Rewrite the JWT secret: replace the template-literal expression
      //   `grc-pulse-jwt-${JWT_VERSION}-2026`
      // with a plain string literal of the desired secret. This keeps the
      // app's verifyJWT in lockstep with the server's session signer.
      contents = contents.replace(
        /`grc-pulse-jwt-\$\{JWT_VERSION\}-2026`/g,
        JSON.stringify(JWT_SECRET),
      )
      // Rewrite the hardcoded sync key wherever it appears as a string literal.
      contents = contents.split("'grcpulse-sync-2024'").join(JSON.stringify(SYNC_KEY))
      return { contents, loader: 'tsx' }
    })
  },
}

await esbuild.build({
  entryPoints: [path.join(projectRoot, 'src', 'index.tsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: path.join(__dirname, 'dist-server', 'app.mjs'),
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  plugins: [syncUrlRewrite, cloudflareShim],
  // Resolve npm dependencies (hono, etc.) from the server's node_modules
  // even though the entry file lives in ../src.
  absWorkingDir: __dirname,
  nodePaths: [path.join(__dirname, 'node_modules')],
  // Keep node built-ins external; bundle npm deps (hono, etc.).
  external: ['node:*'],
  logLevel: 'info',
})

console.log('[build] bundled src/index.tsx -> server/dist-server/app.mjs')
