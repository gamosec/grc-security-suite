/**
 * d1-pg-adapter.mjs
 * =================
 * A drop-in, D1-compatible database adapter backed by PostgreSQL.
 *
 * The GRC Pulse and Pentest Pulse codebases were written for Cloudflare D1 and
 * use the D1 prepared-statement API:
 *
 *     const row  = await env.DB.prepare('SELECT * FROM t WHERE id = ?').bind(id).first()
 *     const list = await env.DB.prepare('SELECT * FROM t').all()           // -> { results: [...] }
 *     const res  = await env.DB.prepare('INSERT ...').bind(...).run()       // -> { success, meta }
 *     await env.DB.batch([stmt1, stmt2])
 *
 * This adapter exposes the *same* surface on top of `pg`, so the application
 * code does not have to change. It also rewrites the small set of SQLite-isms
 * that appear inside runtime queries (positional `?` placeholders and
 * `datetime('now')` style helpers) into their PostgreSQL equivalents.
 *
 * A `search_path` is set on every pooled connection so each app transparently
 * resolves its own schema (grc_pulse / pentest_pulse / autoaudit) without any
 * table-name changes in the application code.
 */

import pg from 'pg'

const { Pool } = pg

// --------------------------------------------------------------------------- //
// Query translation: SQLite (D1) -> PostgreSQL
// --------------------------------------------------------------------------- //

/**
 * Convert `?` positional placeholders to `$1, $2, ...`.
 * Skips `?` characters inside single-quoted string literals.
 */
function convertPlaceholders(sql) {
  let out = ''
  let idx = 0
  let inSingle = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'") {
      // handle escaped '' inside string literals
      if (inSingle && sql[i + 1] === "'") {
        out += "''"
        i++
        continue
      }
      inSingle = !inSingle
      out += ch
    } else if (ch === '?' && !inSingle) {
      idx++
      out += '$' + idx
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Translate SQLite's `INSERT OR REPLACE` / `INSERT OR IGNORE` (unsupported by
 * PostgreSQL) into the equivalent `INSERT ... ON CONFLICT` upsert.
 *
 *   INSERT OR IGNORE INTO t (...) VALUES (...)
 *     -> INSERT INTO t (...) VALUES (...) ON CONFLICT DO NOTHING
 *
 *   INSERT OR REPLACE INTO t (c1, c2, ...) VALUES (...)
 *     -> INSERT INTO t (c1, c2, ...) VALUES (...)
 *        ON CONFLICT (c1) DO UPDATE SET c2 = EXCLUDED.c2, ...
 *
 * REPLACE upserts on the first column, which is the primary key (`id`) for
 * every table this codebase uses OR REPLACE on, and updates every other listed
 * column from the proposed row — matching SQLite's replace-the-whole-row
 * semantics. If we cannot parse a column list we fall back to a plain INSERT
 * with ON CONFLICT DO NOTHING rather than emit invalid SQL.
 *
 * Runs before placeholder conversion, so VALUES still contain `?`; we only ever
 * read the column-name list, never the value list, so that is safe.
 */
function translateInsertOr(sql) {
  if (!/\bINSERT\s+OR\s+(REPLACE|IGNORE)\b/i.test(sql)) return sql

  // INSERT OR IGNORE -> strip the OR IGNORE, append ON CONFLICT DO NOTHING
  // (unless the statement already carries its own ON CONFLICT clause).
  sql = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
  // (handled below after we know whether REPLACE is present)

  // INSERT OR REPLACE INTO <table> ( <cols> ) ...
  const replaceRe = /\bINSERT\s+OR\s+REPLACE\s+INTO\s+([A-Za-z_][A-Za-z0-9_."]*)\s*\(([^)]*)\)/i
  const m = replaceRe.exec(sql)
  if (m) {
    const table = m[1]
    const cols = m[2].split(',').map((c) => c.trim()).filter(Boolean)
    const head = `INSERT INTO ${table} (${m[2]})`
    let conflict
    if (cols.length >= 1) {
      const key = cols[0]
      const updates = cols.slice(1).map((c) => `${c} = EXCLUDED.${c}`)
      conflict = updates.length
        ? ` ON CONFLICT (${key}) DO UPDATE SET ${updates.join(', ')}`
        : ` ON CONFLICT (${key}) DO NOTHING`
    } else {
      conflict = ' ON CONFLICT DO NOTHING'
    }
    // Replace the INSERT...(cols) head, and append the conflict clause at the end.
    sql = sql.replace(replaceRe, head) + conflict
    return sql
  }

  // Only OR IGNORE remained: append DO NOTHING if not already present.
  if (/\bINSERT\s+INTO\b/i.test(sql) && !/\bON\s+CONFLICT\b/i.test(sql)) {
    // Append at the very end of the statement (after VALUES / SELECT source).
    sql = sql.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING')
  }
  return sql
}

/**
 * Translate the handful of SQLite date/time helpers that appear in runtime
 * queries into PostgreSQL equivalents.
 */
function translateSqliteFunctions(sql) {
  let s = translateInsertOr(sql)
  // Normalise double-quoted "now" to the single-quoted form. Some app code
  // writes datetime("now") — in SQLite double quotes fall back to a string
  // literal, but in PostgreSQL "now" is a *column identifier*, which throws
  // `column "now" does not exist`. Rewrite to 'now' so the rules below apply.
  // Only the literal now() helpers are affected; other quoted identifiers are
  // left untouched.
  s = s.replace(/\b(date|datetime)\(\s*"now"\s*(,\s*'[^']*'\s*)?\)/gi,
    (_, fn, modifier) => `${fn}('now'${modifier ? ', ' + modifier.replace(/^,\s*/, '') : ''})`)

  // datetime('now') / date('now') with optional modifier -> native PG values.
  // Native types are required so assignments into TIMESTAMPTZ columns and date
  // arithmetic keep working (a text result would not auto-cast on INSERT).
  s = s.replace(
    /\b(date|datetime)\(\s*'now'\s*,\s*'([^']*)'\s*\)/gi,
    (_, fn, modifier) => {
      const base = fn.toLowerCase() === 'date' ? 'current_date' : 'now()'
      const m = /^([+-]?)\s*(\d+)\s+(\w+)$/.exec(modifier.trim())
      if (!m) return base
      const sign = m[1] === '-' ? '-' : '+'
      return `(${base} ${sign} interval '${m[2]} ${m[3]}')`
    },
  )
  s = s.replace(/\bdatetime\(\s*'now'\s*\)/gi, 'now()')
  s = s.replace(/\bdate\(\s*'now'\s*\)/gi, 'current_date')

  // Mixed-type date comparisons: several migrated date columns are TEXT (ISO
  // strings) while the helpers above are native date/timestamptz. PostgreSQL
  // refuses `text <op> date`. When a bare column is compared against a native
  // "now" expression, cast the COLUMN to the matching type so the comparison
  // succeeds for TEXT columns and is a no-op for already-date/timestamptz ones.
  s = castDateComparisons(s)

  // SQLite string concat already uses || which PG supports.
  // COALESCE / json functions are compatible.
  s = rewriteAliasInHaving(s)
  return s
}

/**
 * Make `<column> <op> <now-expr>` comparisons type-safe.
 *
 * Rewrites e.g. `due_date < current_date` -> `due_date::date < current_date`
 * and `last_seen >= now()` -> `last_seen::timestamptz >= now()`. A TEXT column
 * holding ISO-8601 values casts cleanly; an already-typed column casting to its
 * own type is a no-op. Reversed operand order is handled too. Qualified columns
 * (alias.col) are supported.
 *
 * Only the ORDERING operators (< > <= >=) are rewritten: those appear only in
 * comparisons, never in `SET col = ...` assignments, so UPDATE/INSERT targets
 * are never corrupted. The right-hand "now" expression may be a bare
 * `current_date` / `now()` or an interval-wrapped form produced above, e.g.
 * `(current_date + interval '7 days')`.
 */
function castDateComparisons(s) {
  const col = '([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)?)'
  const op = '(<=|>=|<|>)'
  // The now-expression: bare value or `( <value> ... interval ... )`
  const nowExpr = '(current_date|now\\(\\)|\\((?:current_date|now\\(\\))[^()]*\\))'
  const typeOf = (expr) => (/current_date/i.test(expr) ? 'date' : 'timestamptz')

  // column OP now-expr
  s = s.replace(
    new RegExp(`\\b${col}\\s*${op}\\s*${nowExpr}`, 'gi'),
    (_m, c, o, rhs) => `${c}::${typeOf(rhs)} ${o} ${rhs}`,
  )
  // now-expr OP column
  s = s.replace(
    new RegExp(`${nowExpr}\\s*${op}\\s*${col}`, 'gi'),
    (_m, lhs, o, c) => `${lhs} ${o} ${c}::${typeOf(lhs)}`,
  )
  return s
}

/**
 * SQLite allows a SELECT-list alias to be referenced inside HAVING
 * (e.g. `SELECT COUNT(x) AS control_count ... HAVING control_count > 0`).
 * PostgreSQL forbids aliases in HAVING — it only accepts them in ORDER BY.
 * This rewrites `HAVING <alias> <op> ...` by substituting the underlying
 * aggregate expression that the alias was defined from, so the query becomes
 * valid PostgreSQL without touching the (read-only) application source.
 *
 * Only aggregate-function aliases are substituted; non-aggregate aliases are
 * left untouched (those are valid grouping columns and would not appear in a
 * HAVING comparison in this codebase).
 */
function rewriteAliasInHaving(sql) {
  if (!/\bHAVING\b/i.test(sql)) return sql

  // Collect `<aggregate-expr> AS <alias>` pairs from the SELECT list.
  // Matches e.g. COUNT(crm.id) as control_count, SUM(x) AS total, ...
  const aliasMap = new Map()
  const aliasRe =
    /\b((?:COUNT|SUM|AVG|MIN|MAX|TOTAL)\s*\([^()]*\))\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  let m
  while ((m = aliasRe.exec(sql)) !== null) {
    aliasMap.set(m[2].toLowerCase(), m[1])
  }
  if (aliasMap.size === 0) return sql

  // Replace alias references that appear in the HAVING clause only.
  return sql.replace(/\bHAVING\b([\s\S]*?)(?=\bORDER\b|\bLIMIT\b|\bGROUP\b|$)/i, (full, body) => {
    let newBody = body
    for (const [alias, expr] of aliasMap) {
      const ref = new RegExp(`\\b${alias}\\b`, 'gi')
      newBody = newBody.replace(ref, expr)
    }
    return 'HAVING' + newBody
  })
}

function translateQuery(sql) {
  return convertPlaceholders(translateSqliteFunctions(sql))
}

// --------------------------------------------------------------------------- //
// D1-compatible statement / database wrappers
// --------------------------------------------------------------------------- //

class PgPreparedStatement {
  constructor(pool, sql) {
    this.pool = pool
    this.sql = sql
    this.params = []
  }

  bind(...args) {
    // D1 allows chained .bind(); we create a fresh bound statement so a single
    // prepared statement object can be reused (matches D1 semantics closely
    // enough for this codebase).
    const stmt = new PgPreparedStatement(this.pool, this.sql)
    stmt.params = args
    return stmt
  }

  async _exec() {
    const text = translateQuery(this.sql)
    return this.pool.query({ text, values: this.params })
  }

  /** D1: .first() -> first row or null; .first(col) -> single column value */
  async first(column) {
    const res = await this._exec()
    const row = res.rows[0]
    if (!row) return null
    if (column !== undefined) return row[column]
    return row
  }

  /** D1: .all() -> { results, success, meta } */
  async all() {
    const res = await this._exec()
    return {
      results: res.rows,
      success: true,
      meta: {
        rows_read: res.rowCount ?? res.rows.length,
        changes: res.rowCount ?? 0,
      },
    }
  }

  /** D1: .run() -> { success, meta } */
  async run() {
    const res = await this._exec()
    return {
      success: true,
      results: res.rows,
      meta: {
        changes: res.rowCount ?? 0,
        last_row_id: undefined,
        rows_written: res.rowCount ?? 0,
      },
    }
  }

  /** D1: .raw() -> array of arrays */
  async raw() {
    const res = await this._exec()
    return res.rows.map((r) => Object.values(r))
  }
}

class PgDatabase {
  constructor(pool) {
    this.pool = pool
  }

  prepare(sql) {
    return new PgPreparedStatement(this.pool, sql)
  }

  /**
   * D1 batch: run a list of prepared statements. We run them inside a single
   * transaction to mirror D1's atomic batch semantics.
   */
  async batch(statements) {
    const client = await this.pool.connect()
    const results = []
    try {
      await client.query('BEGIN')
      await client.query('SET CONSTRAINTS ALL DEFERRED')
      for (const stmt of statements) {
        const text = translateQuery(stmt.sql)
        const res = await client.query({ text, values: stmt.params })
        results.push({
          results: res.rows,
          success: true,
          meta: { changes: res.rowCount ?? 0 },
        })
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    return results
  }

  /** D1 exec: run raw multi-statement SQL (used rarely). */
  async exec(sql) {
    const res = await this.pool.query(translateSqliteFunctions(sql))
    return { count: Array.isArray(res) ? res.length : 1, duration: 0 }
  }
}

// --------------------------------------------------------------------------- //
// Factory
// --------------------------------------------------------------------------- //

let _pools = new Map()

/**
 * Create (or reuse) a D1-compatible database object for the given schema.
 *
 * @param {object} opts
 * @param {string} opts.connectionString  PostgreSQL connection string (DATABASE_URL)
 * @param {string} opts.schema            search_path schema (grc_pulse|pentest_pulse|autoaudit)
 * @param {number} [opts.max]             max pool connections
 */
export function createD1Adapter({ connectionString, schema = 'public', max = 10 }) {
  const key = `${connectionString}::${schema}`
  if (_pools.has(key)) {
    return new PgDatabase(_pools.get(key))
  }

  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

  // Ensure every connection resolves the correct schema first.
  pool.on('connect', (client) => {
    client.query(`SET search_path TO ${schema}, public`).catch(() => {})
  })

  pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[d1-pg-adapter] idle client error:', err.message)
  })

  _pools.set(key, pool)
  return new PgDatabase(pool)
}

/** Wait until the database accepts connections (used at server startup). */
export async function waitForDatabase(connectionString, { retries = 30, delayMs = 2000 } = {}) {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 })
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await probe.query('SELECT 1')
      await probe.end()
      return true
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[d1-pg-adapter] waiting for database (${attempt}/${retries})...`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  await probe.end().catch(() => {})
  throw new Error('Database did not become available in time')
}

export { translateQuery }
