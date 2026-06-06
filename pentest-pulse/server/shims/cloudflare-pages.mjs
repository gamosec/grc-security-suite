/**
 * Node-compatible shim for `hono/cloudflare-pages`.
 * The Node server (server.mjs) handles static file serving itself, so the
 * serveStatic exported here is a passthrough no-op middleware. This lets the
 * original application source `import { serveStatic } from 'hono/cloudflare-pages'`
 * compile and run under Node without modification.
 */
export const serveStatic = () => {
  return async (_c, next) => {
    await next()
  }
}

export const handle = (app) => app
