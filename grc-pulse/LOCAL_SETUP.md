# GRC Pulse - Local Setup Guide

## Prerequisites

- Node.js 18+ 
- npm 9+
- Wrangler CLI (`npm install -g wrangler`)

## Quick Start

### 1. Install Dependencies

```bash
cd grcpulse
npm install
```

### 2. Create Local D1 Database

```bash
# Create local database
npx wrangler d1 create grc-pulse-db --local

# Or use the default local database
```

### 3. Apply All Migrations

Apply migrations in order:

```bash
# Apply each migration file
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0002_maturity_assessment.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0003_pentest_sync_support.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0004_compliance_engine.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0005_framework_mappings.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0006_organization_profile.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0007_compliance_history.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0008_extended_history.sql
npx wrangler d1 execute grc-pulse-db --local --file=migrations/0009_control_risk_asset_linking.sql
```

Or run all at once:

```bash
for f in migrations/*.sql; do npx wrangler d1 execute grc-pulse-db --local --file="$f"; done
```

### 4. Seed Demo Data

```bash
# Basic seed data
npx wrangler d1 execute grc-pulse-db --local --file=seed.sql

# Full data export (includes historical snapshots)
npx wrangler d1 execute grc-pulse-db --local --file=export_full_data.sql
```

### 5. Build the Application

```bash
npm run build
```

### 6. Start Development Server

```bash
# Start with PM2 (recommended)
pm2 start ecosystem.config.cjs

# Or start directly with wrangler
npx wrangler pages dev dist --d1=grc-pulse-db --local --ip 0.0.0.0 --port 3000
```

### 7. Access the Application

Open http://localhost:3000

**Demo Login:**
- Email: `admin@acme.com`
- Password: `CisoHub@2026`

## Configuration

### wrangler.jsonc

The configuration file should have:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "grc-pulse",
  "main": "src/index.tsx",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "grc-pulse-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

### ecosystem.config.cjs (PM2)

```javascript
module.exports = {
  apps: [
    {
      name: 'grcpulse',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=grc-pulse-db --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
```

## Database Structure

### Key Tables

| Table | Description |
|-------|-------------|
| `organizations` | Organization profiles |
| `users` | User accounts |
| `assets` | IT assets inventory |
| `risk_items` | Risk register |
| `control_library` | ISO 27001 controls (93 controls) |
| `control_assessments` | Control implementation status |
| `control_mappings` | Cross-framework mappings |
| `control_risk_mappings` | Control-to-risk links (Phase 6) |
| `compliance_frameworks_v2` | Framework definitions |
| `compliance_snapshots` | Historical compliance scores |
| `maturity_assessments` | Maturity evaluation data |
| `vendors` | Third-party vendors |

### Migration Files

1. `0001_initial_schema.sql` - Core tables
2. `0002_maturity_assessment.sql` - Maturity assessment
3. `0003_pentest_sync_support.sql` - PentestPulse integration
4. `0004_compliance_engine.sql` - Compliance framework tables
5. `0005_framework_mappings.sql` - ISO 27001 controls & mappings
6. `0006_organization_profile.sql` - Organization settings
7. `0007_compliance_history.sql` - Historical snapshots
8. `0008_extended_history.sql` - Extended historical data
9. `0009_control_risk_asset_linking.sql` - Control-risk linking (Phase 6)

## Features

### Implemented
- ✅ Executive Dashboard with risk overview
- ✅ Executive Summary (one-page overview)
- ✅ Risk Register with pagination
- ✅ Asset Management
- ✅ Vendor Management
- ✅ Compliance Dashboard (Basic & Advanced modes)
- ✅ Gap Assessment (ISO 27001:2022)
- ✅ Cross-framework compliance scoring
- ✅ Maturity Assessment (CMM-aligned)
- ✅ Risk Mitigation with control-risk linking
- ✅ AI Co-pilot (Llama 3.1)
- ✅ PDF/CSV Export
- ✅ Trend Charts (6-12 months)
- ✅ Auto-snapshots

### Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@acme.com | CisoHub@2026 | Admin |

## Troubleshooting

### Port Already in Use

```bash
fuser -k 3000/tcp
# or
pm2 delete all
```

### Database Issues

```bash
# Reset local database
rm -rf .wrangler/state/v3/d1
# Then re-run migrations
```

### Build Errors

```bash
rm -rf node_modules dist
npm install
npm run build
```

## Production Deployment

```bash
# Deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name grc-pulse
```

## Support

- Live Demo: https://grc-pulse.pages.dev
- GitHub: https://github.com/your-org/grcpulse
