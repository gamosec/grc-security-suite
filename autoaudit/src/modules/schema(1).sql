-- AutoAudit D1 Schema
-- Run this in Cloudflare Dashboard → D1 → your database → Console

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  org_name     TEXT NOT NULL,
  industry     TEXT NOT NULL,
  size         TEXT NOT NULL,
  lang         TEXT NOT NULL DEFAULT 'en',
  phase        TEXT NOT NULL DEFAULT 'idle',
  ctrl_idx     INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gap_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL,
  ctrl_id         TEXT NOT NULL,
  ctrl_name       TEXT NOT NULL,
  verdict         TEXT NOT NULL,
  finding         TEXT,
  recommendation  TEXT,
  evidence_type   TEXT DEFAULT 'none',
  assessed_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL,
  msg_text     TEXT NOT NULL,
  control_id   TEXT,
  control_name TEXT,
  verdict      TEXT,
  file_name    TEXT,
  is_status    INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_session  ON gap_results(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

-- ── Migration for existing databases ──────────────────────────────────────────
-- Run this once in the D1 Console if you already have data:
--
--   ALTER TABLE gap_results ADD COLUMN evidence_type TEXT DEFAULT 'none';
--
-- New databases created from scratch do not need this — the column is included above.
