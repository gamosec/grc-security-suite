# GRC Pulse - Local Setup Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Wrangler CLI (`npm install -g wrangler`)

## Quick Start

### 1. Install Dependencies

```bash
cd grc-pulse
npm install
```

### 2. Create a Local D1 Database

```bash
npx wrangler d1 create grc-pulse-db --local
```

### 3. Apply All Migrations

```bash
for f in migrations/*.sql; do
  npx wrangler d1 execute grc-pulse-db --local --file="$f"
done
```

### 4. Seed Synthetic Demo Data

```bash
npx wrangler d1 execute grc-pulse-db --local --file=seed.sql
```

The public seed contains fictional demonstration data only. Do not import production database exports into this repository or commit them to source control.

### 5. Configure Authentication

Set authentication secrets through your local environment or Cloudflare secrets. Never commit passwords or JWT signing secrets.

### 6. Build the Application

```bash
npm run build
```

### 7. Start Development Server

```bash
npm run dev
```

Or:

```bash
npx wrangler pages dev dist --d1=grc-pulse-db --local --ip 0.0.0.0 --port 3000
```

Open `http://localhost:3000`.

**No default production credentials are included in this repository.** Create disposable local credentials for your own test environment.

## Security Notes

- Never commit database backups or exports.
- Never commit passwords, API keys, JWT secrets, sync keys, or production configuration.
- Use synthetic organization names, users, domains, and findings for public demonstrations.
- If a credential was previously committed, rotate it even after deleting the file.

## Production Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name grc-pulse
```

## Support

- Live Demo: https://grc-pulse.pages.dev
- GitHub: https://github.com/gamosec/grc-security-suite
