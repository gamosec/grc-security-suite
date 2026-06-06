#!/usr/bin/env python3
"""
convert_migrations.py
=====================
Converts the Cloudflare D1 (SQLite) migration + seed SQL files used by the GRC
Security Suite into a single, idempotent PostgreSQL initialisation script.

The Cloudflare production deployment is *not* affected by this script — it only
reads the existing D1 migration files and produces PostgreSQL DDL/DML that the
Docker `postgres` container loads on first boot.

Usage:
    python3 convert_migrations.py

Output:
    docker/db/init/10_grc_pulse_schema.sql
    docker/db/init/20_pentest_pulse_schema.sql
    docker/db/init/30_autoaudit_schema.sql
    docker/db/init/40_grc_pulse_seed.sql        (optional, from seed.sql)
    docker/db/init/50_pentest_pulse_seed.sql    (optional, from seed.sql)

PostgreSQL groups everything under dedicated schemas so the three apps can share
one database without table-name collisions:
    grc_pulse.*       -> GRC Pulse tables
    pentest_pulse.*   -> Pentest Pulse tables
    autoaudit.*       -> AutoAudit tables
"""

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "docker", "db", "init")


# --------------------------------------------------------------------------- #
# Generic SQLite -> PostgreSQL token translation
# --------------------------------------------------------------------------- #
def _split_two_args(arg_str: str):
    """Split a function's argument list into exactly two top-level arguments,
    respecting nested parentheses and single-quoted strings."""
    depth = 0
    in_squote = False
    split_at = -1
    i = 0
    while i < len(arg_str):
        ch = arg_str[i]
        if ch == "'":
            in_squote = not in_squote
        elif not in_squote:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 0:
                split_at = i
                break
        i += 1
    if split_at == -1:
        return None
    return arg_str[:split_at].strip(), arg_str[split_at + 1:].strip()


def convert_instr(sql: str) -> str:
    """Recursively convert SQLite instr(haystack, needle) calls into
    PostgreSQL position(needle in haystack). Handles nesting by processing the
    innermost calls first."""
    pattern = re.compile(r"(?i)\binstr\s*\(")
    while True:
        m = pattern.search(sql)
        if not m:
            break
        start = m.start()
        open_paren = m.end() - 1
        # Find the matching close paren
        depth = 0
        in_squote = False
        j = open_paren
        while j < len(sql):
            c = sql[j]
            if c == "'":
                in_squote = not in_squote
            elif not in_squote:
                if c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        break
            j += 1
        inner = sql[open_paren + 1:j]
        args = _split_two_args(inner)
        if not args:
            # Can't parse; bail to avoid infinite loop
            sql = sql[:start] + "POSITION_UNCONVERTED(" + inner + ")" + sql[j + 1:]
            continue
        haystack, needle = args
        # Recursively convert any instr() inside the arguments first
        haystack = convert_instr(haystack)
        needle = convert_instr(needle)
        replacement = f"position({needle} in {haystack})"
        sql = sql[:start] + replacement + sql[j + 1:]
    # restore accidental marker
    sql = sql.replace("POSITION_UNCONVERTED(", "position(")
    return sql


def strip_sql_comments(sql: str) -> str:
    """Remove -- line comments and /* */ block comments while preserving the
    content of single-quoted string literals. Used only for classification, not
    for the emitted SQL."""
    out = []
    i = 0
    n = len(sql)
    in_squote = False
    while i < n:
        ch = sql[i]
        if in_squote:
            out.append(ch)
            if ch == "'":
                if i + 1 < n and sql[i + 1] == "'":
                    out.append(sql[i + 1])
                    i += 2
                    continue
                in_squote = False
            i += 1
            continue
        if ch == "'":
            in_squote = True
            out.append(ch)
            i += 1
            continue
        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            # skip to end of line
            while i < n and sql[i] != "\n":
                i += 1
            continue
        if ch == "/" and i + 1 < n and sql[i + 1] == "*":
            i += 2
            while i + 1 < n and not (sql[i] == "*" and sql[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def make_fk_deferrable(sql: str) -> str:
    """Within CREATE TABLE statements, append DEFERRABLE INITIALLY DEFERRED to
    each inline REFERENCES clause. Operates only on real REFERENCES keywords
    (comments are ignored because they are matched as whole words after the
    column type), and skips clauses that are already deferrable."""
    # Match: REFERENCES schema.table(cols) [ON DELETE ...] [ON UPDATE ...]
    ref_re = re.compile(
        r"(?i)\bREFERENCES\s+[A-Za-z_][A-Za-z0-9_.]*\s*(?:\([^)]*\))?"
        r"(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))*"
    )

    def repl(m):
        clause = m.group(0)
        if "DEFERRABLE" in clause.upper():
            return clause
        return clause + " DEFERRABLE INITIALLY DEFERRED"

    return ref_re.sub(repl, sql)


def classify_statements(sql: str):
    """Split a converted SQL string into (ddl, dml) where dml contains
    INSERT/UPDATE/DELETE statements and ddl contains everything else
    (CREATE TABLE/INDEX/VIEW, etc.). Comments preceding a statement travel
    with that statement."""
    statements = split_statements(sql)
    ddl, dml = [], []
    for stmt in statements:
        no_comments = strip_sql_comments(stmt).strip().upper()
        if no_comments.startswith("INSERT") or no_comments.startswith("UPDATE") \
                or no_comments.startswith("DELETE"):
            dml.append(stmt)
        else:
            ddl.append(stmt)
    return "".join(ddl), "".join(dml)


def sqlite_to_pg(sql: str) -> str:
    """Translate SQLite dialect tokens to PostgreSQL.

    The conversion is intentionally conservative: it only rewrites constructs
    that actually appear in the suite's migration files.
    """
    s = sql

    # Strip SQLite-only PRAGMA lines entirely
    s = re.sub(r"(?im)^\s*PRAGMA[^;]*;\s*$", "", s)

    # ---- date/time function helpers -------------------------------------- #
    # date('now', '-6 months') -> (current_date - interval '6 months')
    # datetime('now', '-6 months') -> (now() - interval '6 months')
    def _date_modifier(m):
        fn = m.group(1).lower()
        modifier = m.group(2).strip()  # e.g. -6 months
        base = "current_date" if fn == "date" else "now()"
        mm = re.match(r"^([+-]?)\s*(\d+)\s+(\w+)$", modifier)
        if not mm:
            return base
        sign = "-" if mm.group(1) == "-" else "+"
        qty = mm.group(2)
        unit = mm.group(3)
        return f"({base} {sign} interval '{qty} {unit}')"

    s = re.sub(
        r"(?i)\b(date|datetime)\(\s*'now'\s*,\s*'([^']*)'\s*\)",
        _date_modifier,
        s,
    )
    # date('now') -> current_date
    s = re.sub(r"(?i)\bdate\(\s*'now'\s*\)", "current_date", s)

    # DEFAULT (datetime('now'))  -> DEFAULT now()
    s = re.sub(r"(?i)\(\s*datetime\(\s*'now'\s*\)\s*\)", "now()", s)
    s = re.sub(r"(?i)datetime\(\s*'now'\s*\)", "now()", s)
    # CURRENT_TIMESTAMP stays valid in PG (no change needed)

    # TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8))))  -> gen helper
    # PostgreSQL has no randomblob; use a deterministic random-hex expression.
    s = re.sub(
        r"(?i)\(\s*lower\(\s*hex\(\s*randomblob\(\s*\d+\s*\)\s*\)\s*\)\s*\)",
        "(encode(gen_random_bytes(8), 'hex'))",
        s,
    )

    # ---- type translation ------------------------------------------------ #
    # SQLite REAL -> PostgreSQL DOUBLE PRECISION
    s = re.sub(r"(?i)\bREAL\b", "DOUBLE PRECISION", s)
    # SQLite DATETIME / TIMESTAMP-without-tz -> PostgreSQL TIMESTAMPTZ
    s = re.sub(r"(?i)\bDATETIME\b", "TIMESTAMPTZ", s)
    # SQLite "BOOLEAN" maps fine, but DEFAULT 0/1 handled by INTEGER columns

    # ---- view handling --------------------------------------------------- #
    # CREATE VIEW IF NOT EXISTS x  -> CREATE OR REPLACE VIEW x
    s = re.sub(r"(?i)\bCREATE\s+VIEW\s+IF\s+NOT\s+EXISTS\b",
               "CREATE OR REPLACE VIEW", s)
    s = re.sub(r"(?i)\bCREATE\s+VIEW\b", "CREATE OR REPLACE VIEW", s)
    # SQLite "INTEGER PRIMARY KEY AUTOINCREMENT" -> "BIGSERIAL PRIMARY KEY"
    s = re.sub(
        r"(?i)\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b",
        "BIGSERIAL PRIMARY KEY",
        s,
    )
    # Any leftover AUTOINCREMENT keyword (not valid in PG)
    s = re.sub(r"(?i)\bAUTOINCREMENT\b", "", s)
    # BLOB -> BYTEA
    s = re.sub(r"(?i)\bBLOB\b", "BYTEA", s)

    # ---- function translation -------------------------------------------- #
    # SQLite instr(haystack, needle) -> PostgreSQL position(needle in haystack)
    s = convert_instr(s)

    # ---- conflict handling ----------------------------------------------- #
    # INSERT OR IGNORE INTO  -> INSERT INTO ... (ON CONFLICT appended later)
    s = re.sub(r"(?i)\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", s)
    # INSERT OR REPLACE INTO -> INSERT INTO  (treated as plain insert)
    s = re.sub(r"(?i)\bINSERT\s+OR\s+REPLACE\s+INTO\b", "INSERT INTO", s)

    return s


def add_on_conflict_do_nothing(sql: str) -> str:
    """For statements that were `INSERT OR IGNORE`, append ON CONFLICT DO NOTHING.

    We detect them via a marker comment inserted before conversion.
    """
    out_lines = []
    statements = split_statements(sql)
    for stmt in statements:
        if "__IGNORE__" in stmt:
            # Remove the marker token (it sits right after the table name)
            stmt = stmt.replace("__IGNORE__", "")
            # Only append ON CONFLICT if this chunk does not already have one
            if "ON CONFLICT" not in stmt.upper():
                trailing_ws = ""
                core = stmt
                # Preserve trailing whitespace after the semicolon
                m = re.search(r";(\s*)$", stmt)
                if m:
                    trailing_ws = m.group(1)
                    core = stmt[: m.start()]
                    core = core.rstrip()
                    stmt = core + "\nON CONFLICT DO NOTHING;" + trailing_ws
                else:
                    stmt = stmt.rstrip() + "\nON CONFLICT DO NOTHING"
        out_lines.append(stmt)
    return "".join(out_lines)


def split_statements(sql: str):
    """Naive but adequate SQL splitter that keeps the trailing ';' and the
    whitespace between statements. Good enough for these migration files which
    do not contain procedural blocks or stray semicolons inside strings beyond
    simple values."""
    parts = []
    buf = []
    in_squote = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        buf.append(ch)
        if ch == "'":
            # handle escaped '' inside string
            if in_squote and i + 1 < len(sql) and sql[i + 1] == "'":
                buf.append(sql[i + 1])
                i += 2
                continue
            in_squote = not in_squote
        elif ch == ";" and not in_squote:
            parts.append("".join(buf))
            buf = []
        i += 1
    if buf:
        parts.append("".join(buf))
    return parts


def mark_ignore_inserts(sql: str) -> str:
    """Insert a marker right after the table name for INSERT OR IGNORE
    statements so we can append ON CONFLICT DO NOTHING after conversion."""
    # Place the marker as a comment token we can find later. We add it just
    # after 'INSERT OR IGNORE INTO <table>'.
    def repl(m):
        return m.group(0) + " /*__IGNORE__*/ "

    return re.sub(r"(?i)\bINSERT\s+OR\s+IGNORE\s+INTO\s+[A-Za-z_][A-Za-z0-9_]*",
                  repl, sql)


def schema_qualify(sql: str, schema: str, table_names: set) -> str:
    """Prefix known table names with the target schema so that all three apps
    can coexist in one database. We only qualify identifiers that are known
    table names to avoid touching column names."""
    if not table_names:
        return sql
    # Build a regex alternation of table names, longest first to avoid partial
    # matches (e.g. 'risk' vs 'risk_items').
    names = sorted(table_names, key=len, reverse=True)
    alt = "|".join(re.escape(n) for n in names)

    # Contexts where a table name appears:
    #   FROM x, JOIN x, INTO x, UPDATE x, REFERENCES x, TABLE [IF NOT EXISTS] x,
    #   DELETE FROM x, INDEX ... ON x
    patterns = [
        (r"(?i)(\bFROM\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bJOIN\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bINTO\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bUPDATE\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bREFERENCES\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bTABLE\s+IF\s+NOT\s+EXISTS\s+)(" + alt + r")\b",
         r"\1" + schema + r".\2"),
        (r"(?i)(\bTABLE\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bVIEW\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
        (r"(?i)(\bON\s+)(" + alt + r")\s*\(", r"\1" + schema + r".\2("),
        (r"(?i)(\bEXISTS\s+)(" + alt + r")\b", r"\1" + schema + r".\2"),
    ]
    out = sql
    for pat, rep in patterns:
        out = re.sub(pat, rep, out)
    # Avoid double-qualifying (schema.schema.table)
    out = re.sub(r"(?i)\b" + re.escape(schema) + r"\.\s*" + re.escape(schema) + r"\.",
                 schema + ".", out)
    return out


def extract_table_names(sql_files) -> set:
    names = set()
    for path in sql_files:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        for m in re.finditer(
            r"(?im)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)",
            text,
        ):
            names.add(m.group(1))
        # Also collect view names so cross-references get schema-qualified
        for m in re.finditer(
            r"(?im)CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)",
            text,
        ):
            names.add(m.group(1))
    return names


def convert_files(sql_files, schema, table_names):
    """Convert and return (ddl_sql, dml_sql) with statements separated so the
    init loader can create all tables first, then load data with deferred FK
    checks."""
    ddl_chunks = []
    dml_chunks = []
    for path in sql_files:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        # Strip SQL comments up-front (preserving string literals) so that
        # words like "References" inside comments never get misinterpreted as
        # SQL keywords during later transformations.
        raw = strip_sql_comments(raw)
        marked = mark_ignore_inserts(raw)
        marked = marked.replace("/*__IGNORE__*/", "__IGNORE__")
        converted = sqlite_to_pg(marked)
        converted = add_on_conflict_do_nothing(converted)
        converted = schema_qualify(converted, schema, table_names)
        ddl, dml = classify_statements(converted)
        ddl = make_fk_deferrable(ddl)
        header = f"\n-- ===== {os.path.relpath(path, ROOT)} =====\n"
        if ddl.strip():
            ddl_chunks.append(header + ddl)
        if dml.strip():
            dml_chunks.append(header + dml)
    return "\n".join(ddl_chunks), "\n".join(dml_chunks)


def write_schema(filename, schema, ddl_body):
    """Write a DDL-only init file (tables, indexes, views)."""
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write("-- AUTO-GENERATED by docker/scripts/convert_migrations.py\n")
        f.write("-- Do not edit by hand. Re-run the converter to regenerate.\n")
        f.write("CREATE EXTENSION IF NOT EXISTS pgcrypto;\n")
        f.write(f"CREATE SCHEMA IF NOT EXISTS {schema};\n")
        f.write(f"SET search_path TO {schema}, public;\n")
        f.write(ddl_body)
        f.write("\n")
    print(f"  wrote {os.path.relpath(path, ROOT)}")
    return path


def write_data(filename, schema, dml_body):
    """Write a DML-only init file (demo + seed data) inside one transaction
    with deferred FK checks so cross-references resolve at COMMIT."""
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write("-- AUTO-GENERATED by docker/scripts/convert_migrations.py\n")
        f.write("-- Do not edit by hand. Re-run the converter to regenerate.\n")
        f.write(f"SET search_path TO {schema}, public;\n")
        f.write("BEGIN;\n")
        f.write("SET CONSTRAINTS ALL DEFERRED;\n")
        f.write(dml_body)
        f.write("\nCOMMIT;\n")
    print(f"  wrote {os.path.relpath(path, ROOT)}")
    return path


def main():
    grc_migrations = sorted(
        [
            os.path.join(ROOT, "grc-pulse", "migrations", f)
            for f in os.listdir(os.path.join(ROOT, "grc-pulse", "migrations"))
            if f.endswith(".sql")
        ]
    )
    pentest_migrations = sorted(
        [
            os.path.join(ROOT, "pentest-pulse", "migrations", f)
            for f in os.listdir(os.path.join(ROOT, "pentest-pulse", "migrations"))
            if f.endswith(".sql")
        ]
    )

    grc_seed = os.path.join(ROOT, "grc-pulse", "seed.sql")
    pentest_seed = os.path.join(ROOT, "pentest-pulse", "seed.sql")

    print("Converting GRC Pulse migrations + seed...")
    grc_tables = extract_table_names(grc_migrations)
    grc_ddl, grc_dml = convert_files(grc_migrations, "grc_pulse", grc_tables)
    grc_seed_dml = ""
    if os.path.exists(grc_seed):
        _, grc_seed_dml = convert_files([grc_seed], "grc_pulse", grc_tables)
    # Compatibility: the GRC Pulse app references a `users_new` relation that
    # production created at runtime (never in a migration). It has the same
    # shape as `users`, so we expose it as an auto-updatable view.
    grc_ddl += (
        "\n-- ===== on-prem compatibility: users_new =====\n"
        "CREATE OR REPLACE VIEW grc_pulse.users_new AS\n"
        "  SELECT * FROM grc_pulse.users;\n"
    )
    # Compatibility: the GRC Pulse app references control_assessments columns
    # (manual_override flag + risk_warnings JSON) that production added at
    # runtime but that never appear in a committed migration. Add them
    # idempotently so advisory-mode and the Pentest Pulse sync upsert work.
    grc_ddl += (
        "\n-- ===== on-prem compatibility: control_assessments extra columns =====\n"
        "ALTER TABLE grc_pulse.control_assessments\n"
        "  ADD COLUMN IF NOT EXISTS manual_override INTEGER DEFAULT 0;\n"
        "ALTER TABLE grc_pulse.control_assessments\n"
        "  ADD COLUMN IF NOT EXISTS risk_warnings TEXT;\n"
    )
    # Compatibility: audit_findings.affected_controls is a JSON-string column the
    # app writes when creating findings (src/index.tsx) and reads during the
    # risk<->finding compliance sync on PATCH /api/risks/:id. Production added it
    # at runtime; it is absent from any committed migration, so updating a risk
    # 500s without it. Add idempotently.
    grc_ddl += (
        "\n-- ===== on-prem compatibility: audit_findings.affected_controls =====\n"
        "ALTER TABLE grc_pulse.audit_findings\n"
        "  ADD COLUMN IF NOT EXISTS affected_controls TEXT;\n"
    )
    write_schema("10_grc_pulse_schema.sql", "grc_pulse", grc_ddl)
    # Seed data correction: the committed seed.sql ships a demo risk
    # ("Missing MFA on Admin Accounts") tagged risk_source='penetration_test'
    # but it has no Pentest Pulse origin (external_reference IS NULL). That made
    # the GRC "Pentest" count (9) disagree with the real synced findings (8).
    # Re-tag any such demo rows to 'manual' so they no longer appear under the
    # Pentest source while remaining valid risks. Real synced risks always carry
    # external_reference LIKE 'pentest:%', so this can never touch them.
    grc_seed_fixup = (
        "\n-- ===== on-prem seed correction: untie demo risks from Pentest source =====\n"
        "UPDATE grc_pulse.risk_items\n"
        "   SET risk_source = 'manual'\n"
        " WHERE risk_source = 'penetration_test'\n"
        "   AND (external_reference IS NULL OR external_reference NOT LIKE 'pentest:%');\n"
    )
    # Seed correction (auth hardening): the committed GRC seed never set a
    # password_hash for the demo users — in production they only ever logged in
    # via the universal master password ('CisoHub@2026'). The on-prem build
    # BLOCKS that master password, so without a real credential the demo
    # accounts would be locked out. Give any password-less demo user a bcrypt
    # hash for the documented default password 'GrcDemo!2026' (rounds=12). This
    # only touches rows that have no hash, so it can never clobber a real
    # password set by an operator, and it lets a fresh deploy log in immediately
    # WITHOUT the master password. Change the password after first login.
    GRC_DEMO_PASSWORD = "GrcDemo!2026"
    GRC_DEMO_BCRYPT = "$2a$12$wQPJJbPAic83PNUbeCRmwOkOIXMHR.7/tkey.3LsJwoG6lSm/Da82"
    grc_seed_fixup += (
        "\n-- ===== on-prem seed correction: bcrypt password for demo users =====\n"
        f"-- Default demo password: {GRC_DEMO_PASSWORD} (bcrypt, change after first login)\n"
        "UPDATE grc_pulse.users\n"
        f"   SET password_hash = '{GRC_DEMO_BCRYPT}'\n"
        " WHERE password_hash IS NULL OR password_hash = '';\n"
    )
    # Seed base data first, then migration-embedded demo data, then the fixup
    write_data("40_grc_pulse_data.sql", "grc_pulse",
               "\n-- seed.sql\n" + grc_seed_dml + "\n-- migration demo data\n" + grc_dml
               + grc_seed_fixup)

    print("Converting Pentest Pulse migrations + seed...")
    pentest_tables = extract_table_names(pentest_migrations)
    pentest_ddl, pentest_dml = convert_files(pentest_migrations, "pentest_pulse", pentest_tables)
    pentest_seed_dml = ""
    if os.path.exists(pentest_seed):
        _, pentest_seed_dml = convert_files([pentest_seed], "pentest_pulse", pentest_tables)
    # Compatibility: evidence_files.data_url holds a base64 data URI for evidence
    # screenshots when storage_method == 'database' (the inline-image fallback the
    # report PDF renders). The app both writes it (POST /api/findings/:id/evidence)
    # and reads it (SELECT ... data_url in /api/findings-with-evidence, used by the
    # report preview). Production added it at runtime; it is absent from any
    # committed migration, so generating a report 500s ("column data_url does not
    # exist") and evidence uploads fail. Add idempotently.
    pentest_ddl += (
        "\n-- ===== on-prem compatibility: evidence_files.data_url =====\n"
        "ALTER TABLE pentest_pulse.evidence_files\n"
        "  ADD COLUMN IF NOT EXISTS data_url TEXT;\n"
    )
    write_schema("20_pentest_pulse_schema.sql", "pentest_pulse", pentest_ddl)
    write_data("50_pentest_pulse_data.sql", "pentest_pulse",
               "\n-- seed.sql\n" + pentest_seed_dml + "\n-- migration demo data\n" + pentest_dml)

    # AutoAudit schema (hand-maintained source -> converted)
    autoaudit_schema = os.path.join(ROOT, "autoaudit", "src", "modules", "schema(1).sql")
    consultant_extra = """
-- Consultant session tables (created via API in the Cloudflare version)
CREATE TABLE IF NOT EXISTS consultant_sessions (
  id          TEXT PRIMARY KEY,
  org         TEXT,
  industry    TEXT,
  lang        TEXT NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultant_messages (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES consultant_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  msg_text    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_sessions (
  id           TEXT PRIMARY KEY,
  org_name     TEXT NOT NULL,
  industry     TEXT,
  size         TEXT,
  framework    TEXT,
  policy_type  TEXT,
  policy_ref   TEXT,
  policy_json  TEXT,
  lang         TEXT NOT NULL DEFAULT 'en',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultant_msgs_session ON consultant_messages(session_id);
"""
    print("Converting AutoAudit schema...")
    autoaudit_tables = extract_table_names([autoaudit_schema]) if os.path.exists(autoaudit_schema) else set()
    autoaudit_tables |= {"consultant_sessions", "consultant_messages", "policy_sessions"}
    ddl_parts = []
    if os.path.exists(autoaudit_schema):
        a_ddl, _ = convert_files([autoaudit_schema], "autoaudit", autoaudit_tables)
        ddl_parts.append(a_ddl)
    extra_converted = schema_qualify(sqlite_to_pg(consultant_extra), "autoaudit", autoaudit_tables)
    extra_converted = make_fk_deferrable(extra_converted)
    ddl_parts.append(extra_converted)
    write_schema("30_autoaudit_schema.sql", "autoaudit", "\n".join(ddl_parts))

    print("Done.")


if __name__ == "__main__":
    main()
