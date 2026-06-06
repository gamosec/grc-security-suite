# 💾 Database Backups

This folder contains database backups from the production Cloudflare D1 databases.

## ⚠️ Important Security Notice

These backups may contain **sensitive data**. If you're making this repository public:
- Remove this `backups/` folder
- Or add `backups/` to `.gitignore`

## 📁 Contents

```
backups/
├── grc-pulse/
│   └── database-backup.sql      # Full GRC Pulse database backup
├── pentest-pulse/
│   └── database-backup.sql      # Full Pentest Pulse database backup
└── README.md                    # This file
```

## 🔄 Restore Instructions

### Restore to Cloudflare D1

```bash
# Create new database
wrangler d1 create grcpulse-new

# Restore backup
wrangler d1 execute grcpulse-new --remote --file=./backups/grc-pulse/database-backup.sql
```

### Restore to Local SQLite

```bash
# Using SQLite CLI
sqlite3 local-grcpulse.db < ./backups/grc-pulse/database-backup.sql
```

## 📅 Backup Info

| Database | Size | Date |
|----------|------|------|
| GRC Pulse | ~468 KB | Jan 29, 2026 |
| Pentest Pulse | ~66 KB | Jan 29, 2026 |

---

*For new environments, you can start fresh by just running migrations and using seed.sql for demo data.*
