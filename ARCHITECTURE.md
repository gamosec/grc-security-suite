# 🏗️ GRC Security Suite - Complete Architecture Guide

> **Purpose**: This document provides everything needed to understand, modify, and migrate the codebase. Read this FIRST before exploring the code.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication & Sessions](#authentication--sessions)
7. [AI Integration](#ai-integration)
8. [Migration Requirements](#migration-requirements)
9. [Key Files Reference](#key-files-reference)

---

## 🎯 System Overview

### Three Integrated Systems:

| System | Purpose | Port | Database |
|--------|---------|------|----------|
| **AutoAudit** | ISO 27001 Gap Analysis & Policy Generator | 3001 | D1 (sessions only) |
| **GRC Pulse** | Risk & Compliance Management | 3002 | D1 (full relational) |
| **Pentest Pulse** | Penetration Testing Management | 3003 | D1 (full relational) |

### Integration Flow:
```
Pentest Pulse ──[findings]──► GRC Pulse ──[compliance status]──► AutoAudit
                                 │
                                 └──► Risk Register
```

---

## 🛠️ Tech Stack

### Current Stack (Cloudflare):

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18 + Vite | Single-page applications |
| Backend | Hono Framework | Lightweight, runs on Workers |
| Database | Cloudflare D1 | SQLite-based, serverless |
| AI | Cloudflare Workers AI | Llama 3.1 8B model |
| Hosting | Cloudflare Pages | Global CDN |
| Auth | Cookie-based sessions | Stored in D1 |

### Target Stack (Production/On-Premise):

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18 + Vite | No changes needed |
| Backend | Hono or Express | Needs PostgreSQL adapter |
| Database | **PostgreSQL** | Standard, portable |
| AI | **Ollama** (local) or OpenAI API | Self-hosted option |
| Hosting | **Docker** | Portable containers |
| Auth | JWT or session-based | Standard approach |

---

## 📁 Project Structure

```
grc-security-suite/
│
├── autoaudit/                      # ISO 27001 Gap Analysis
│   ├── src/
│   │   ├── App.jsx                 # Main React app, routing
│   │   ├── main.jsx                # Entry point
│   │   └── modules/
│   │       ├── GapModule.jsx       # ⭐ Gap Analysis (2000+ lines)
│   │       ├── PolicyModule.jsx    # ⭐ Policy Generator (1800+ lines)
│   │       └── ConsultantModule.jsx
│   ├── functions/                  # Cloudflare Workers API
│   │   └── api/
│   │       ├── chat.js             # AI chat endpoint
│   │       ├── session.js          # Gap analysis sessions
│   │       └── policy-session.js   # Policy sessions
│   ├── package.json
│   └── vite.config.js
│
├── grc-pulse/                      # Risk & Compliance Management
│   ├── src/
│   │   ├── index.tsx               # ⭐ Hono API + React pages (4000+ lines)
│   │   └── renderer.tsx            # JSX renderer
│   ├── migrations/                 # D1 database migrations
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_maturity_assessment.sql
│   │   ├── 0003_pentest_sync_support.sql
│   │   ├── 0004_compliance_engine.sql
│   │   ├── 0005_framework_mappings.sql
│   │   ├── 0006_organization_profile.sql
│   │   ├── 0007_compliance_history.sql
│   │   ├── 0008_extended_history.sql
│   │   ├── 0009_control_risk_asset_linking.sql
│   │   └── 0010_audit_management.sql
│   ├── seed.sql                    # Demo data
│   ├── package.json
│   ├── wrangler.jsonc              # Cloudflare config
│   └── vite.config.ts
│
├── pentest-pulse/                  # Pentest Management
│   ├── src/
│   │   ├── index.tsx               # ⭐ Hono API + React pages (2500+ lines)
│   │   └── renderer.tsx
│   ├── migrations/
│   │   └── 0001_initial_schema.sql # All tables
│   ├── grcpulse-integration/       # GRC Pulse connector
│   │   └── grcpulse-receiver-endpoints.ts
│   ├── seed.sql                    # Demo data
│   ├── package.json
│   └── wrangler.jsonc
│
└── backups/                        # Database backups
    ├── grc-pulse/database-backup.sql
    └── pentest-pulse/database-backup.sql
```

---

## 🗄️ Database Schema

### AutoAudit Tables (Created via API):

```sql
-- Gap Analysis Sessions
CREATE TABLE gap_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    organization_name TEXT,
    industry TEXT,
    size TEXT,
    status TEXT DEFAULT 'setup',  -- setup, questioning, complete
    current_control INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gap Analysis Results
CREATE TABLE gap_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    control_id TEXT,
    control_name TEXT,
    verdict TEXT,  -- Compliant, Partial, Non-Compliant
    finding TEXT,
    recommendation TEXT,
    evidence_type TEXT,  -- document, screenshot, self_declaration, none
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gap Analysis Messages (Chat History)
CREATE TABLE gap_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,  -- user, assistant
    content TEXT,
    control_id TEXT,
    control_name TEXT,
    verdict TEXT,
    file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Policy Sessions
CREATE TABLE policy_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    organization_name TEXT,
    policy_type TEXT,
    language TEXT,
    content TEXT,  -- JSON blob
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### GRC Pulse Tables (10 migrations):

```sql
-- Core Tables
organizations (id, name, slug, industry, size, subscription_tier, compliance_frameworks)
users (id, organization_id, email, first_name, last_name, role, status)
risks (id, organization_id, title, description, category, likelihood, impact, status, owner_id)
controls (id, organization_id, name, description, type, status, owner_id)
assets (id, organization_id, name, type, criticality, data_classification)

-- Compliance Tables
frameworks (id, name, version, description)
framework_controls (id, framework_id, control_ref, title, description)
compliance_assessments (id, organization_id, framework_id, status, score)
compliance_control_status (id, assessment_id, control_id, status, evidence)

-- Linking Tables
control_risk_mappings (control_id, risk_id)
asset_risk_mappings (asset_id, risk_id)
control_asset_mappings (control_id, asset_id)

-- Audit Tables
audits (id, organization_id, name, type, status, start_date, end_date)
audit_findings (id, audit_id, title, severity, status)

-- History Tables
compliance_history (id, organization_id, framework_id, score, recorded_at)
risk_history (id, risk_id, field_changed, old_value, new_value, changed_at)
```

### Pentest Pulse Tables (1 migration):

```sql
organizations (id, name, slug, industry)
users (id, organization_id, email, password_hash, name, role, status)
assets (id, organization_id, name, type, url, criticality, data_classification)
projects (id, organization_id, project_code, name, methodology, status, start_date, end_date)
findings (id, organization_id, project_id, asset_id, title, severity, likelihood, impact, 
          owasp_category, cwe_id, status, recommendation, proof_of_concept)
reports (id, organization_id, project_id, title, report_type, status, executive_summary)
```

---

## 🔌 API Endpoints

### AutoAudit API (`/api/...`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | AI chat (Cloudflare Workers AI) |
| `/api/session` | GET | Load gap session |
| `/api/session` | POST | Create/update gap session |
| `/api/session` | DELETE | Delete gap session |
| `/api/policy-session` | GET/POST/DELETE | Policy sessions |

### GRC Pulse API (`/api/...`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/risks` | GET/POST | List/create risks |
| `/api/risks/:id` | GET/PUT/DELETE | Single risk CRUD |
| `/api/controls` | GET/POST | List/create controls |
| `/api/assets` | GET/POST | List/create assets |
| `/api/frameworks` | GET | List compliance frameworks |
| `/api/compliance/assess` | POST | Run compliance assessment |
| `/api/dashboard/stats` | GET | Dashboard statistics |
| `/api/pentest-sync` | POST | Receive findings from Pentest Pulse |

### Pentest Pulse API (`/api/...`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/:id` | GET/PUT/DELETE | Single project CRUD |
| `/api/findings` | GET/POST | List/create findings |
| `/api/findings/:id` | GET/PUT/DELETE | Single finding CRUD |
| `/api/assets` | GET/POST | List/create assets |
| `/api/reports` | GET/POST | Generate reports |
| `/api/sync-to-grc` | POST | Push findings to GRC Pulse |

---

## 🔐 Authentication & Sessions

### Current Implementation (Cloudflare):

```javascript
// Cookie-based session (AutoAudit)
// Session ID stored in localStorage, data in D1

// API pattern in functions/api/session.js:
export async function onRequestGet(context) {
    const { env } = context;
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    
    const result = await env.DB.prepare(
        'SELECT * FROM gap_sessions WHERE id = ?'
    ).bind(id).first();
    
    return new Response(JSON.stringify(result));
}
```

### For PostgreSQL Migration:

```javascript
// Use connection pool
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Query pattern
const result = await pool.query(
    'SELECT * FROM gap_sessions WHERE id = $1',
    [id]
);
```

---

## 🤖 AI Integration

### Current: Cloudflare Workers AI

```javascript
// In functions/api/chat.js
export async function onRequestPost(context) {
    const { env } = context;
    const { messages } = await context.request.json();
    
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: messages,
        max_tokens: 2048
    });
    
    return new Response(JSON.stringify({
        content: [{ text: response.response }]
    }));
}
```

### For On-Premise: Ollama

```javascript
// Replace with Ollama API
const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: messages,
        stream: false
    })
});

const data = await response.json();
return { content: [{ text: data.message.content }] };
```

### For Cloud: OpenAI API

```javascript
// Or use OpenAI
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages
});

return { content: [{ text: response.choices[0].message.content }] };
```

---

## 🔄 Migration Requirements

### Database Migration (D1 → PostgreSQL):

1. **Schema Changes**:
   - `TEXT` → `TEXT` (same)
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `DATETIME DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMP DEFAULT NOW()`
   - `JSON` stored as TEXT → Use `JSONB` type

2. **Query Changes**:
   - `?` placeholders → `$1, $2, $3` placeholders
   - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
   - `env.DB.prepare().bind().run()` → `pool.query()`

3. **Connection**:
   - D1: `env.DB` binding
   - PostgreSQL: Connection pool with `DATABASE_URL`

### API Migration (Cloudflare Workers → Express/Hono):

```javascript
// Current (Cloudflare Workers)
export async function onRequestPost(context) {
    const { env } = context;
    // ...
}

// Target (Hono on Node.js)
app.post('/api/endpoint', async (c) => {
    const pool = c.get('db');
    // ...
});
```

### AI Migration:

| Source | Target | Effort |
|--------|--------|--------|
| Cloudflare Workers AI | Ollama (local) | Medium |
| Cloudflare Workers AI | OpenAI API | Easy |
| Cloudflare Workers AI | Azure OpenAI | Easy |

---

## 📄 Key Files Reference

### Must-Read Files:

| File | Lines | Purpose |
|------|-------|---------|
| `autoaudit/src/modules/GapModule.jsx` | ~2000 | Core gap analysis logic |
| `autoaudit/src/modules/PolicyModule.jsx` | ~1800 | Policy generation |
| `autoaudit/functions/api/chat.js` | ~50 | AI integration point |
| `grc-pulse/src/index.tsx` | ~4000 | All GRC Pulse backend + frontend |
| `pentest-pulse/src/index.tsx` | ~2500 | All Pentest Pulse backend + frontend |
| `grc-pulse/migrations/*.sql` | ~150KB | Complete database schema |

### Configuration Files:

| File | Purpose |
|------|---------|
| `*/wrangler.jsonc` | Cloudflare configuration |
| `*/package.json` | Dependencies |
| `*/vite.config.ts` | Build configuration |

---

## 🐳 Docker Migration Plan

### Target docker-compose.yml:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: grc
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: grc_suite
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    # Run: docker exec -it ollama ollama pull llama3.1:8b

  autoaudit:
    build: ./autoaudit
    environment:
      DATABASE_URL: postgres://grc:${DB_PASSWORD}@postgres:5432/grc_suite
      AI_PROVIDER: ollama
      OLLAMA_URL: http://ollama:11434
    ports:
      - "3001:3000"
    depends_on:
      - postgres
      - ollama

  grc-pulse:
    build: ./grc-pulse
    environment:
      DATABASE_URL: postgres://grc:${DB_PASSWORD}@postgres:5432/grc_suite
    ports:
      - "3002:3000"
    depends_on:
      - postgres

  pentest-pulse:
    build: ./pentest-pulse
    environment:
      DATABASE_URL: postgres://grc:${DB_PASSWORD}@postgres:5432/grc_suite
    ports:
      - "3003:3000"
    depends_on:
      - postgres

volumes:
  postgres_data:
  ollama_data:
```

---

## ✅ Migration Checklist

- [ ] Create PostgreSQL schema from D1 migrations
- [ ] Update database queries (? → $1 placeholders)
- [ ] Replace D1 bindings with PostgreSQL pool
- [ ] Create AI abstraction layer (Ollama/OpenAI/Workers AI)
- [ ] Create Dockerfiles for each service
- [ ] Create docker-compose.yml
- [ ] Test locally with Docker
- [ ] Create environment variable templates
- [ ] Update documentation

---

## 📞 Quick Reference

### Start Development (Current):
```bash
cd autoaudit && npm run dev      # localhost:5173
cd grc-pulse && npm run dev      # localhost:5174
cd pentest-pulse && npm run dev  # localhost:5175
```

### Start Production (Target):
```bash
docker-compose up -d
# AutoAudit:    http://localhost:3001
# GRC Pulse:    http://localhost:3002
# Pentest Pulse: http://localhost:3003
```

---

*Last Updated: June 2026*
*Version: 1.0.0*
