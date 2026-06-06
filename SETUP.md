# 🚀 GRC Security Suite - Setup Guide

This guide explains how to deploy the GRC Security Suite to a new environment.

---

## 📊 Database Architecture

| System | Database Type | Migrations | Seed Data |
|--------|---------------|------------|-----------|
| AutoAudit | Cloudflare D1 | Auto-created | None needed |
| GRC Pulse | Cloudflare D1 | 10 files | Demo data included |
| Pentest Pulse | Cloudflare D1 | 1 file | Demo data included |

### Important Notes:
- **Source code contains SCHEMA only** (table structures)
- **Live data stays in Cloudflare D1** (never in GitHub)
- **Seed files contain demo data** for testing

---

## 🔧 New Deployment Setup

### Prerequisites
```bash
# Install Node.js 18+
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 1: Clone Repository
```bash
git clone https://github.com/gamosec/grc-security-suite.git
cd grc-security-suite
```

### Step 2: Set Up AutoAudit

```bash
cd autoaudit

# Install dependencies
npm install

# No database setup needed - AutoAudit uses Cloudflare Workers AI
# Sessions are stored automatically

# Local development
npm run dev

# Deploy to Cloudflare
npm run build
wrangler pages deploy dist --project-name autoaudit
```

### Step 3: Set Up GRC Pulse

```bash
cd ../grc-pulse

# Install dependencies
npm install

# Create D1 database
wrangler d1 create grcpulse-db

# Update wrangler.jsonc with the database_id from above command
# Edit wrangler.jsonc and replace the database_id

# Run all migrations (creates tables)
wrangler d1 migrations apply grcpulse-db --local   # For local dev
wrangler d1 migrations apply grcpulse-db --remote  # For production

# (Optional) Load demo data
wrangler d1 execute grcpulse-db --local --file=./seed.sql   # Local
wrangler d1 execute grcpulse-db --remote --file=./seed.sql  # Production

# Local development
npm run dev

# Deploy to Cloudflare
npm run build
wrangler pages deploy dist --project-name grcpulse
```

### Step 4: Set Up Pentest Pulse

```bash
cd ../pentest-pulse

# Install dependencies
npm install

# Create D1 database
wrangler d1 create pentestpulse-db

# Update wrangler.jsonc with the database_id

# Run migrations
wrangler d1 migrations apply pentestpulse-db --local   # Local
wrangler d1 migrations apply pentestpulse-db --remote  # Production

# (Optional) Load demo data
wrangler d1 execute pentestpulse-db --local --file=./seed.sql   # Local
wrangler d1 execute pentestpulse-db --remote --file=./seed.sql  # Production

# Local development
npm run dev

# Deploy to Cloudflare
npm run build
wrangler pages deploy dist --project-name pentestpulse
```

---

## 📁 Migration Files Explained

### GRC Pulse Migrations

| File | Purpose |
|------|---------|
| `0001_initial_schema.sql` | Core tables: organizations, users, risks, controls, assets |
| `0002_maturity_assessment.sql` | Maturity assessment features |
| `0003_pentest_sync_support.sql` | Integration with Pentest Pulse |
| `0004_compliance_engine.sql` | Compliance tracking engine |
| `0005_framework_mappings.sql` | ISO 27001, PCI-DSS, NIST mappings |
| `0006_organization_profile.sql` | Organization settings |
| `0007_compliance_history.sql` | Compliance history tracking |
| `0008_extended_history.sql` | Extended audit history |
| `0009_control_risk_asset_linking.sql` | Linking tables |
| `0010_audit_management.sql` | Audit management features |

### Pentest Pulse Migrations

| File | Purpose |
|------|---------|
| `0001_initial_schema.sql` | All tables: projects, findings, assets, reports, users |

---

## 🔄 Migrating Existing Data

### Export from Current Cloudflare D1

```bash
# Export GRC Pulse data
wrangler d1 export grcpulse-production --output=grcpulse-backup.sql

# Export Pentest Pulse data
wrangler d1 export pentestpulse-production --output=pentestpulse-backup.sql
```

### Import to New Environment

```bash
# Import to new database
wrangler d1 execute NEW-DB-NAME --remote --file=./grcpulse-backup.sql
```

---

## 🌐 Environment Variables

### GRC Pulse (wrangler.jsonc)
```jsonc
{
  "name": "grcpulse",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "grcpulse-db",
      "database_id": "YOUR-DATABASE-ID-HERE"
    }
  ]
}
```

### Pentest Pulse (wrangler.jsonc)
```jsonc
{
  "name": "pentestpulse",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "pentestpulse-db",
      "database_id": "YOUR-DATABASE-ID-HERE"
    }
  ]
}
```

---

## 🐳 Docker Deployment (Future)

Docker support is planned. The setup will be:

```bash
docker-compose up -d
```

This will start:
- AutoAudit on port 3001
- GRC Pulse on port 3002
- Pentest Pulse on port 3003
- SQLite databases (local storage)

---

## 🔐 Production Checklist

- [ ] Create separate D1 databases for production
- [ ] Update wrangler.jsonc with production database IDs
- [ ] Run all migrations on production databases
- [ ] Set up custom domains (optional)
- [ ] Enable Cloudflare security features (WAF, Bot protection)
- [ ] Set up monitoring and alerts
- [ ] Configure backup schedule for D1 databases
- [ ] Test all integrations between systems

---

## 🆘 Troubleshooting

### "Database not found" error
- Ensure you've created the D1 database with `wrangler d1 create`
- Verify the database_id in wrangler.jsonc matches

### "Table does not exist" error
- Run migrations: `wrangler d1 migrations apply DB-NAME --remote`

### "Permission denied" error
- Run `wrangler login` to authenticate
- Ensure your Cloudflare account has access to the project

---

## 📞 Support

For issues or questions:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error messages and steps to reproduce

---

*Last updated: June 2026*
