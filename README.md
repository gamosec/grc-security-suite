# 🛡️ GRC Security Suite

A comprehensive Governance, Risk, and Compliance (GRC) platform consisting of three integrated modules for enterprise security management.

## 📦 Modules

| Module | Description | Status |
|--------|-------------|--------|
| [AutoAudit](./autoaudit/) | ISO 27001:2022 Gap Analysis & Policy Generator | ✅ Production |
| [GRC Pulse](./grc-pulse/) | Risk & Compliance Management Dashboard | ✅ Production |
| [Pentest Pulse](./pentest-pulse/) | Penetration Testing Management | ✅ Production |

---

## 🚀 AutoAudit

**ISO 27001:2022 Gap Analysis & Automated Policy Generator**

### Features:
- 📋 **Gap Analysis Agent** - AI-powered assessment of all 93 ISO 27001:2022 controls
- 📄 **Policy Generator** - Automated creation of security policies aligned with ISO/PCI-DSS
- 📎 **Evidence-Based Evaluation** - Document upload with smart verification
- 📊 **Compliance Scoring** - Real-time compliance percentage tracking
- 🌐 **Multi-language** - English and Arabic support

### Tech Stack:
- React + Vite
- Cloudflare Workers AI (Llama 3.1)
- Cloudflare D1 (SQLite)
- Cloudflare Pages

---

## 📊 GRC Pulse

**Enterprise Risk & Compliance Management Dashboard**

### Features:
- 🎯 **Risk Register** - Comprehensive risk identification and tracking
- 📈 **Risk Assessment** - Quantitative and qualitative risk analysis
- 🔄 **Control Mapping** - Map controls to risks and compliance frameworks
- 📋 **Compliance Tracking** - Monitor compliance status across frameworks
- 📊 **Dashboards** - Visual risk and compliance metrics
- 🔗 **Integration** - Links with AutoAudit and Pentest Pulse

### Tech Stack:
- React + TypeScript + Vite
- Hono (Backend API)
- Cloudflare D1 (SQLite)
- Cloudflare Pages

---

## 🔍 Pentest Pulse

**Penetration Testing Management Platform**

### Features:
- 📝 **Project Management** - Organize pentest engagements
- 🎯 **Vulnerability Tracking** - Log and categorize findings
- 📊 **CVSS Scoring** - Automated severity calculation
- 📄 **Report Generation** - Professional pentest reports
- 🔗 **GRC Integration** - Push findings to GRC Pulse risk register

### Tech Stack:
- React + TypeScript + Vite
- Hono (Backend API)
- Cloudflare D1 (SQLite)
- Cloudflare Pages

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GRC Security Suite                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   AutoAudit     │    GRC Pulse    │    Pentest Pulse        │
│   (Gap Analysis)│ (Risk & Comply) │   (Pentest Mgmt)        │
├─────────────────┴─────────────────┴─────────────────────────┤
│                 Cloudflare Workers (API)                     │
├─────────────────────────────────────────────────────────────┤
│                 Cloudflare D1 (Database)                     │
├─────────────────────────────────────────────────────────────┤
│                 Cloudflare Pages (Hosting)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Options

### Option 1: Cloudflare Pages (Current Production)

Each module is deployed independently to Cloudflare Pages:

| Module | URL |
|--------|-----|
| AutoAudit | https://autoaudit.pages.dev |
| GRC Pulse | https://grcpulse.pages.dev |
| Pentest Pulse | https://pentestpulse.pages.dev |

### Option 2: Self-Hosted / On-Premise

Each module can be deployed independently:

```bash
# Clone the repository
git clone https://github.com/gamosec/grc-security-suite.git
cd grc-security-suite

# Deploy AutoAudit
cd autoaudit
npm install
npm run build
# Deploy dist/ to your hosting

# Deploy GRC Pulse
cd ../grc-pulse
npm install
npm run build
# Deploy dist/ to your hosting

# Deploy Pentest Pulse
cd ../pentest-pulse
npm install
npm run build
# Deploy dist/ to your hosting
```

### Option 3: Docker (Coming Soon)

```bash
docker-compose up -d
```

---

## 📁 Project Structure

```
grc-security-suite/
├── autoaudit/           # ISO 27001 Gap Analysis & Policy Generator
│   ├── src/
│   │   ├── modules/
│   │   │   ├── GapModule.jsx      # Gap Analysis Agent
│   │   │   ├── PolicyModule.jsx   # Policy Generator
│   │   │   └── ConsultantModule.jsx
│   │   └── App.jsx
│   ├── functions/       # Cloudflare Workers API
│   └── package.json
│
├── grc-pulse/           # Risk & Compliance Management
│   ├── src/
│   │   ├── index.tsx    # Hono API routes
│   │   └── pages/       # React pages
│   ├── migrations/      # D1 database migrations
│   └── package.json
│
├── pentest-pulse/       # Penetration Testing Management
│   ├── src/
│   │   └── index.tsx    # Hono API routes
│   ├── migrations/      # D1 database migrations
│   └── package.json
│
└── README.md            # This file
```

---

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (for D1 database)

### Local Development

```bash
# AutoAudit
cd autoaudit
npm install
npm run dev

# GRC Pulse
cd grc-pulse
npm install
npm run dev

# Pentest Pulse
cd pentest-pulse
npm install
npm run dev
```

---

## 📋 Database Setup

Each module uses Cloudflare D1. Create databases:

```bash
# AutoAudit
wrangler d1 create autoaudit-db

# GRC Pulse
wrangler d1 create grcpulse-db

# Pentest Pulse
wrangler d1 create pentestpulse-db
```

Run migrations:

```bash
cd grc-pulse && wrangler d1 migrations apply grcpulse-db --local
cd pentest-pulse && wrangler d1 migrations apply pentestpulse-db --local
```

---

## 🔐 Security Considerations

- All data stored in Cloudflare D1 (encrypted at rest)
- No sensitive data in client-side code
- API routes protected by Cloudflare Workers
- Session management via secure cookies

---

## 📄 License

Private - All Rights Reserved

---

## 👤 Author

**gamosec**

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-06 | Initial unified release |
