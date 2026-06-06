# GRC Pulse v1.0-stable Restore Point

**Created**: 2026-01-13
**Purpose**: Backup before multi-tenant SaaS refactor

## Restore Options

### Option 1: Git Tag (Code Only)
```bash
# To restore code to v1.0-stable
cd /home/user/grcpulse
git checkout v1.0-stable

# To create a branch from this point
git checkout -b feature/my-branch v1.0-stable
```

### Option 2: Full Project Backup (Code + Git History)
**Download URL**: https://www.genspark.ai/api/files/s/DcZPZifD
**Size**: 5.2 MB

```bash
# To restore from backup
cd /home/user
rm -rf grcpulse
tar -xzf grcpulse-v1.0-stable-before-saas.tar.gz
```

### Option 3: Database Backup
**File**: `db-backup-v1.0-stable.sql` (314KB)
**Location**: `/home/user/grcpulse/db-backup-v1.0-stable.sql`

```bash
# To restore database (creates new DB)
npx wrangler d1 create grc-pulse-db-restored
npx wrangler d1 execute grc-pulse-db-restored --file=db-backup-v1.0-stable.sql

# To restore to existing DB (WARNING: destructive)
# First drop all tables, then:
npx wrangler d1 execute grc-pulse-db --remote --file=db-backup-v1.0-stable.sql
```

## What's Included in v1.0-stable

### Features
- Dashboard & Executive Summary
- Risk Register with quick status toggle
- Risk Mitigation (Control-Risk mapping)
- Audit Management (Programs, Engagements, Findings)
- Gap Assessment & Compliance Dashboard
- Organization Settings
- PentestPulse Integration
- AI Co-pilot
- Bi-directional sync (Risk ↔ Finding ↔ Control)

### Performance Optimizations
- Batched DB queries with db.batch()
- Proper database indexes
- Pagination for large lists

### Current Limitations (Why we're refactoring)
- Hardcoded `org-001` in 45 places
- Single-tenant only
- No tenant registration
- Master password authentication

## Commit History
```
784968d Performance optimization: batch DB queries
01029ac Add quick status toggle dropdowns
6b4a182 Fix reverse sync: always sync when status provided
f3b2e61 Add bi-directional control sync
7545ef9 Fix bi-directional sync
```

## Live URLs at this Version
- **Production**: https://grc-pulse.pages.dev
- **Cloudflare Project**: grc-pulse

## Database Info
- **Name**: grc-pulse-db
- **ID**: 03a784d7-1d5e-49e6-94a0-1fff6b9a3b3d
- **Tables**: 30+
- **Rows**: ~500 (small test data)
