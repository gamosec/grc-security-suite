# GRCpulse - Complete AI Context Documentation

> **CRITICAL: Read this entire document before making any changes to the project.**

## Quick Reference

| Item | Value |
|------|-------|
| **Production URL** | https://grc-pulse.pages.dev |
| **Project Directory** | `/home/user/grcpulse` |
| **Cloudflare Project Name** | `grc-pulse` |
| **Database Name** | `sentient-grc-db` |
| **Database ID** | `03a784d7-1d5e-49e6-94a0-1fff6b9a3b3d` |
| **Main Source File** | `src/index.tsx` |
| **Framework** | Hono + TypeScript |
| **Platform** | Cloudflare Pages + D1 + Workers AI |

## CRITICAL DEPLOYMENT COMMANDS

```bash
# ALWAYS use these exact commands:
cd /home/user/grcpulse && npm run build
cd /home/user/grcpulse && npx wrangler pages deploy dist --project-name grc-pulse

# Database queries (REMOTE - production):
npx wrangler d1 execute sentient-grc-db --remote --command="YOUR SQL HERE"

# NEVER deploy to 'sentient-grc' - that's a different/old project!
```

## Project Overview

GRCpulse is a **Governance, Risk, and Compliance (GRC)** management platform that helps organizations:
- Manage security risks and vulnerabilities
- Track compliance with frameworks (ISO 27001, NIST, SOC2, GDPR, etc.)
- Manage security controls and their effectiveness
- Monitor vendors and supply chain risk
- Conduct audits and assessments
- **Sync findings from PentestPulse** (sister application)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────┤
│  Cloudflare Pages        │  Cloudflare D1      │ Workers AI │
│  (grc-pulse)             │  (sentient-grc-db)  │ (AI)       │
│  - Static assets         │  - SQLite database  │ - Analysis │
│  - Worker functions      │  - 50+ tables       │ - Suggest. │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PentestPulse Integration                 │
│  URL: https://pentest-pulse.pages.dev                       │
│  Sync Key: grcpulse-sync-2024                               │
│  Endpoint: /api/external/findings?org_id={org_id}           │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
/home/user/grcpulse/
├── src/
│   └── index.tsx          # Main application (ALL code is here - 15000+ lines)
├── public/                # Static assets
├── dist/                  # Build output (deployed to Cloudflare)
├── wrangler.jsonc         # Cloudflare configuration
├── package.json           # Dependencies
├── vite.config.ts         # Vite build configuration
├── tsconfig.json          # TypeScript configuration
└── CONTEXT.md             # This file
```

## Database Schema (Key Tables)

### Organizations
```sql
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,           -- e.g., 'org-001', 'org-002', 'org-003'
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'smb', 'enterprise')),
    subscription_tier TEXT DEFAULT 'starter',
    settings TEXT DEFAULT '{}',
    logo_url TEXT,
    compliance_frameworks TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
);
```

### Users
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'analyst' CHECK (role IN ('super_admin', 'org_admin', 'security_lead', 'analyst', 'auditor', 'vendor')),
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, email)
);
```

### Risk Items (includes synced PentestPulse findings)
```sql
CREATE TABLE risk_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    title TEXT NOT NULL,
    description TEXT,
    risk_source TEXT NOT NULL CHECK (risk_source IN (
        'vulnerability_scan', 'penetration_test', 'audit_finding', 
        'self_assessment', 'vendor_assessment', 'threat_intel', 
        'incident', 'manual', 'ai_detected'
    )),
    external_reference TEXT,      -- For pentest sync: 'pentest:{finding_id}|{project_code}|{org_id}'
    category TEXT,
    inherent_likelihood REAL,     -- 0-1 scale
    inherent_impact REAL,         -- 0-1 scale
    inherent_score REAL,
    status TEXT DEFAULT 'open' CHECK (status IN (
        'open', 'in_progress', 'mitigated', 'accepted', 
        'transferred', 'closed', 'false_positive'
    )),
    ai_analysis TEXT DEFAULT '{}', -- Stores pentest metadata for synced items
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Controls
```sql
CREATE TABLE controls (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    control_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    implementation_status TEXT DEFAULT 'not_started',
    effectiveness_rating TEXT,
    UNIQUE(organization_id, control_id)
);
```

### Control-Risk Mappings
```sql
CREATE TABLE control_risk_mappings (
    id TEXT PRIMARY KEY,
    control_id TEXT REFERENCES controls(id),
    risk_id TEXT REFERENCES risk_items(id),
    mapping_type TEXT,
    effectiveness_contribution REAL
);
```

## Current Organizations

| ID | Name | Notes |
|----|------|-------|
| org-001 | GRCPulse Corporation | Main demo org |
| org-002 | TechStart Inc | Secondary demo org |
| org-003 | Almadar aljadid | User's organization |

## Authentication System

- **Method**: JWT-based sessions stored in cookies
- **Cookie Name**: `session`
- **JWT Secret**: `grc-pulse-jwt-v5-2026`
- **Session Duration**: 7 days

### Auth Middleware Flow
```typescript
// Session payload stored in JWT
type SessionPayload = {
  userId: string
  email: string
  name: string
  orgId: string      // CRITICAL: This determines which org's data is accessed
  role: string
  exp: number
}

// Middleware sets these context variables:
c.set('orgId', session.orgId)      // Used by all API endpoints
c.set('userId', session.userId)
c.set('userEmail', session.email)
c.set('userName', session.name)
c.set('userRole', session.role)
```

## PentestPulse Integration

### Sync Configuration
```typescript
const PENTEST_PULSE_CONFIG = {
  baseUrl: 'https://pentest-pulse.pages.dev',
  apiKey: 'grcpulse-sync-2024',  // X-Sync-Key header
  timeout: 15000
}
```

### Sync Endpoint
```
POST /api/sync/pentest/pull

- Gets orgId from authenticated user's session
- Calls PentestPulse: GET /api/external/findings?org_id={orgId}
- Creates/updates risk_items with risk_source='penetration_test'
- Returns: { success, organization_id, results: { created, updated, deleted, total } }
```

### Status Mapping (PentestPulse → GRCpulse)
```typescript
const statusMap = {
  'open': 'open',
  'draft': 'open',
  'in_progress': 'in_progress',
  'remediated': 'mitigated',
  'fixed': 'mitigated',
  'verified': 'mitigated',
  'accepted': 'accepted',
  'closed': 'closed',
  'false_positive': 'false_positive'
}
```

## Key API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/check` - Verify session validity

### Risk Management
- `GET /api/risks` - List risks for user's org
- `POST /api/risks` - Create new risk
- `GET /api/risks/:id` - Get single risk
- `PUT /api/risks/:id` - Update risk
- `DELETE /api/risks/:id` - Delete risk

### PentestPulse Sync
- `POST /api/sync/pentest/pull` - Pull findings from PentestPulse

### Controls
- `GET /api/controls` - List controls
- `POST /api/controls` - Create control
- `GET /api/control-risk-mappings` - Get control-risk relationships

### Compliance
- `GET /api/compliance/dashboard` - Compliance overview
- `GET /api/frameworks` - List compliance frameworks

## Common Issues & Solutions

### Issue: Deploying to wrong project
**Problem**: Code deployed to `sentient-grc` instead of `grc-pulse`
**Solution**: Always use `--project-name grc-pulse` in deploy command

### Issue: Sync not working for specific org
**Problem**: PentestPulse findings not appearing in Risk Register
**Check**:
1. Org IDs match between GRC and PentestPulse
2. API key is `grcpulse-sync-2024`
3. User is logged in to correct organization

### Issue: Database query on wrong database
**Problem**: Changes not appearing on production
**Solution**: Use `sentient-grc-db` (not `grc-pulse-db` which doesn't exist)

## Build & Deploy Checklist

1. [ ] Make code changes in `/home/user/grcpulse/src/index.tsx`
2. [ ] Build: `cd /home/user/grcpulse && npm run build`
3. [ ] Deploy: `npx wrangler pages deploy dist --project-name grc-pulse`
4. [ ] Verify at: https://grc-pulse.pages.dev
5. [ ] Test functionality

## Related Projects

| Project | URL | Directory | Database |
|---------|-----|-----------|----------|
| GRCpulse | https://grc-pulse.pages.dev | /home/user/grcpulse | sentient-grc-db |
| PentestPulse | https://pentest-pulse.pages.dev | /home/user/pentestpulse | pentest-pulse-db |

## Version History

- **v5** (Current): Multi-org PentestPulse sync, JWT auth
- **v4**: Compliance engine, framework management
- **v3**: Control-risk mapping
- **v2**: Basic risk management
- **v1**: Initial release

---

**Last Updated**: 2026-02-19
**Maintained By**: AI Assistant
