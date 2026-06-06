# GRC Pulse - Real-time Risk Intelligence

> **AI ASSISTANTS**: Before modifying this project, read [CONTEXT.md](./CONTEXT.md) for complete technical documentation including deployment commands, database schemas, and integration details. Also see [/home/user/MASTER_CONTEXT.md](/home/user/MASTER_CONTEXT.md) for ecosystem overview.

<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z' fill='url(%23g)'/%3E%3Cpath d='M20 52H35L42 38L50 65L58 42L65 52H80' stroke='white' stroke-width='5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E" alt="GRC Pulse Logo" />
</p>

<p align="center">
  <strong>Enterprise GRC Platform for Modern CISOs</strong><br>
  Combat alert fatigue • Break organizational silos • Real-time risk intelligence
</p>

<p align="center">
  <a href="https://grc-pulse.pages.dev">Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## 🎯 Overview

**GRC Pulse** is an enterprise-grade Governance, Risk, and Compliance (GRC) platform that provides real-time risk intelligence for Chief Information Security Officers (CISOs) and security teams.

### Key Differentiators

| Feature | Traditional GRC | GRC Pulse |
|---------|-----------------|-----------|
| Risk Scoring | CVSS-only | Business context-aware |
| Alert Management | Manual triage | AI-powered prioritization |
| Data Visualization | Static reports | Interactive real-time graphs |
| Maturity Assessment | External tools | Built-in CMM/ISO 27001 |
| AI Assistant | None | FREE Llama 3.1 Co-pilot |
| Deployment | On-premise servers | Edge (Cloudflare Workers) |

---

## 🌐 Live Demo

| Environment | URL |
|-------------|-----|
| **Production** | https://grc-pulse.pages.dev |
| **Sandbox** | https://3000-imvkied2bokxpzekr7roc-5c13a017.sandbox.novita.ai |

### Demo Credentials

**Admin Account:**
```
Email:    admin@acme.com
Password: CisoHub@2026
```

**Pentester Account (for testing RBAC):**
```
Email:    baragammo@gmail.com
Password: H@ckMe@2030
```

---

## ✨ Features

### 1. Authentication & Security

| Feature | Description |
|---------|-------------|
| Secure Login | Email/password authentication |
| Session Management | HTTP-only cookies (XSS protection) |
| Role-Based Access | 7 roles with granular permissions |
| Audit Logging | Complete activity trail |
| Multi-Tenant | Organization isolation |
| User Invitation | Secure token-based account setup |

#### 7-Role RBAC System

| Role | Icon | GRC Access | PentestPulse | Org Admin |
|------|------|------------|--------------|-----------|
| **Admin** | ⚙️ | Full Access | ✅ | ✅ |
| **CISO** | 👔 | Full Access | ✅ | ❌ |
| **Executive** | 📊 | Dashboard & Reports | ✅ | ❌ |
| **GRC Manager** | 🛡️ | Full GRC Modules | ✅ | ❌ |
| **Auditor** | 📋 | Audit & Compliance | ❌ | ❌ |
| **Pentester** | 🎯 | None | ✅ | ❌ |
| **Viewer** | 👁️ | Read-Only | ✅ | ❌ |

**Module Access Matrix:**

| Module | Admin | CISO | Executive | GRC Mgr | Auditor | Pentester | Viewer |
|--------|-------|------|-----------|---------|---------|-----------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Executive Summary | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Risk Register | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Risk Mitigation | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Assets | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Vendors | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Compliance | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Gap Assessment | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Controls | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Audit Dashboard | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Audit Programs | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| AI Co-pilot | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Org Admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pentest Pulse | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

### 2. Executive Dashboard

Real-time metrics for security leadership:

- **Risk Overview**: Total risks, critical/high counts, financial exposure
- **Vendor Health**: Active incidents, certification status
- **Compliance Score**: Framework coverage percentage (with risk penalty)
- **Asset Status**: Criticality distribution, data classification

### 2.1 Risk-Adjusted Compliance Scoring (Live Feed)

**NEW:** Compliance scores automatically adjust based on active risks from **ALL sources** using a GRC best-practice model:

#### Severity-Based Penalties

| Risk Severity | Score Range | Penalty | Notes |
|---------------|-------------|---------|-------|
| **Critical** | > 60 | -2 pts each | Immediate attention required |
| **High** | 40-60 | -1 pt each | Action within 30 days |
| **Medium** | 20-40 | Tiered | Based on accumulation (see below) |
| **Low** | < 20 | 0 pts | Accept/monitor |

#### Medium Risk Tiered Penalty (Accumulation Model)

Medium risks use a tiered penalty to prevent "risk debt" accumulation:

| # Medium Risks | Penalty | Status |
|----------------|---------|--------|
| 1-2 | 0 pts | ✅ Acceptable |
| 3-5 | -1 pt | ⚠️ Attention Needed |
| 6-9 | -2 pts | 🟠 Action Required |
| 10+ | -3 pts | 🔴 Systemic Issue |

#### Supported Risk Sources (Live Feed)

| Source | Icon | Description |
|--------|------|-------------|
| 🐛 **Pentest** | Purple | Findings synced from PentestPulse |
| 📋 **Audit** | Blue | Findings from compliance audits |
| ✏️ **Self-Assessment** | Green | Manually added by GRC managers |
| 🏢 **Vendor** | Orange | Third-party/vendor-related risks |
| ⚖️ **Compliance Gap** | Pink | Gaps identified in framework assessments |

#### Penalty Rules
- Only applies to **active risks** (status: `open` or `in_progress`)
- Maximum penalty capped at **25 points**
- All sources contribute to the same penalty pool
- Score cannot go below 0%

#### Example Calculation
- Base compliance score: **86%**
- Critical: 2 risks (−4pts)
- High: 3 risks (−3pts)  
- Medium: 5 risks (−1pt, tiered)
- **Total penalty: −8 points**
- Adjusted score: **78%**

The Compliance Dashboard shows a **live feed banner** with breakdown by source and severity, including medium risk tier status.

### 3. Context-Aware Risk Engine

Unlike traditional CVSS-only scoring:

```
Business Context Score = Base Risk × Business Impact × Data Sensitivity
```

| Factor | Weight | Description |
|--------|--------|-------------|
| Revenue Impact | 40% | Correlation with revenue-generating processes |
| Data Classification | 30% | PII, PCI, PHI sensitivity flags |
| Asset Criticality | 20% | Infrastructure tier classification |
| Regulatory Requirements | 10% | Compliance framework mappings |

### 4. Asset Management

| Field | Options |
|-------|---------|
| Asset Types | Server, Database, Application, Network Device, Endpoint, Cloud Service, Data Store |
| Cloud Providers | AWS, Azure, GCP, On-Premise |
| Criticality Levels | Critical, High, Medium, Low |
| Data Classification | Public, Internal, Confidential, Restricted |
| Sensitive Data Flags | PII, PCI, PHI |

### 5. Vendor Risk Management

| Field | Description |
|-------|-------------|
| Vendor Tiers | Critical, High, Medium, Low |
| Incident Tracking | Security breaches, outages, compliance issues |
| Certifications | SOC2, ISO27001, GDPR, PCI-DSS |
| Process Mapping | Business process dependencies |

### 6. Unified Compliance Dashboard

**Multi-Framework Compliance Engine** with ISO 27001:2022 as the core library:

| Framework | Controls | Mappings | Description |
|-----------|----------|----------|-------------|
| **ISO 27001:2022** | 93 | Core | Information Security Management System |
| NIST CSF 2.0 | 47 | 31 from ISO | Cybersecurity Framework |
| PCI-DSS v4.0 | 51 | 54 from ISO | Payment Card Industry Standard |
| SOC 2 | 48 | 51 from ISO | Service Organization Controls |
| GDPR | 26 | 14 from ISO | EU Data Protection Regulation |

**Cross-Framework Scoring:**
- Implement ISO 27001 controls → automatic score calculation for mapped frameworks
- Equivalent mappings = 100% credit
- Partial mappings = 50% credit
- Real-time dashboard shows all framework scores in one view

**Gap Assessment by Domain (ISO 27001:2022):**

| Theme | Controls | Description |
|-------|----------|-------------|
| Organizational (A.5) | 37 | Policies, organization of security |
| People (A.6) | 8 | Human resource security |
| Physical (A.7) | 14 | Physical and environmental security |
| Technological (A.8) | 34 | System and communications protection |

### 7. Organization Profile & Framework Applicability

**Auto-detect applicable frameworks based on:**
- Industry (Healthcare, Finance, Technology, etc.)
- Operating regions (US, EU, APAC, etc.)
- Data types handled (Card data, Health data, Personal data)

**Framework Applicability Rules:**
| Data Type | Framework | Applicability |
|-----------|-----------|---------------|
| Payment Card Data | PCI-DSS | Required |
| EU Personal Data | GDPR | Required |
| US Government Data | NIST CSF | Recommended |
| SaaS/Technology | SOC 2 | Recommended |

### 8. Statement of Applicability (SoA) Generator

ISO 27001:2022 SoA with:
- All 93 controls with applicability status
- Justification for exclusions
- Implementation status and evidence
- Export to JSON/CSV

### 9. Interactive Risk Graph

Force-directed visualization showing relationships:

| Node Type | Shape | Color | Description |
|-----------|-------|-------|-------------|
| Business Process | Circle | Purple | Revenue-critical processes |
| Asset | Square | Blue | IT infrastructure |
| Vendor | Diamond | Green | Third-party suppliers |
| Risk | Circle | Red | Security risks |

**Features:**
- Zoom/Pan navigation
- Hover tooltips
- Click-to-navigate
- Filter by type
- Real-time statistics

### 10. Security Maturity Assessment

#### CMM-Based Model (Aligned with ISO/IEC 27001)

**9 Assessment Categories:**

| # | Category (EN) | Category (AR) | Questions |
|---|---------------|---------------|-----------|
| 1 | Governance & Management Commitment | حوكمة ومدى التزام الإدارة بدعم أمن المعلومات | 4 |
| 2 | Security Policies | سياسات أمن المعلومات | 3 |
| 3 | Organizational Structure | الهيكل التنظيمي لأمن المعلومات | 7 |
| 4 | HR Security | أمن الموارد البشرية | 5 |
| 5 | Communication | التواصل | 2 |
| 6 | Supplier Security | أمن الموردين | 4 |
| 7 | Risk Management | إدارة المخاطر | 3 |
| 8 | Incident Response | الاستجابة للحوادث | 3 |
| 9 | Business Continuity | استمرارية الأعمال | 1 |
| **Total** | | | **32** |

**6-Level Maturity Scale:**

| Level | English | Arabic | Description |
|-------|---------|--------|-------------|
| 0 | Not Performed | لم يتم التنفيذ | Process not implemented |
| 1 | Performed Informally | يتم بشكل غير رسمي | Ad-hoc, undocumented |
| 2 | Planned | مخطط له | Documented but not fully implemented |
| 3 | Well Defined | محدد بشكل جيد | Standardized and documented |
| 4 | Quantitatively Controlled | يتم التحكم به كمياً | Measured and monitored |
| 5 | Continuously Improving | تحسين مستمر | Optimized and evolving |

**Features:**
- Real-time radar chart (Chart.js)
- Bilingual questions (English/Arabic)
- Persistent D1 database storage
- Full CRUD operations
- Assessment history tracking
- Automatic scoring with percentage

### 11. AI Co-pilot (FREE)

| Specification | Value |
|---------------|-------|
| Model | Llama 3.1 8B Instruct |
| Provider | Cloudflare Workers AI |
| Cost | **$0 (FREE)** |
| Max Tokens | 500 (chat), 600 (quick actions) |
| Temperature | 0.7 (chat), 0.5 (quick actions) |

**Quick Actions:**

| Action | Description |
|--------|-------------|
| Risk Mitigation | Analyze risk and provide mitigation strategies |
| ISO 27001 Checklist | Compliance gap analysis |
| Vendor Assessment | Third-party security evaluation |
| Maturity Advice | Improvement recommendations |
| Incident Response | Response procedure guidance |

---

## 🛠️ Technology Stack

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │   Workers   │  │   Workers AI        │  │
│  │  (Static)   │  │   (API)     │  │   (Llama 3.1)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│          │               │                   │               │
│          └───────────────┼───────────────────┘               │
│                          │                                   │
│                    ┌─────▼─────┐                             │
│                    │    D1     │                             │
│                    │ (SQLite)  │                             │
│                    └───────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Stack Details

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | HTML/CSS/JavaScript | Single-page application |
| Styling | Tailwind CSS (CDN) | Utility-first CSS |
| Icons | Font Awesome 6.4 | UI iconography |
| Charts | Chart.js | Radar/graph visualization |
| Backend | Hono (TypeScript) | Lightweight web framework |
| Database | Cloudflare D1 (SQLite) | Edge-native database |
| AI | Cloudflare Workers AI | LLM inference |
| Build | Vite | Fast build tool |
| Deploy | Cloudflare Pages | Edge deployment |

---

## 📡 API Reference

### Base URL

```
Production: https://grc-pulse.pages.dev/api
```

### Authentication

All API routes require a valid session cookie obtained via login.

```bash
# Login
curl -X POST https://grc-pulse.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"AdminGrc@2030"}'
```

### Endpoints

#### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Risk overview with all metrics |

#### Risks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/risks` | List risks (filter: `?status=open`) |
| GET | `/api/risks/:id` | Get risk with context |
| POST | `/api/risks` | Create risk |
| PATCH | `/api/risks/:id` | Update risk |
| DELETE | `/api/risks/:id` | Delete risk |

#### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List assets (filter: `?type=server&criticality=critical`) |
| GET | `/api/assets/:id` | Get asset with dependencies |
| POST | `/api/assets` | Create asset |
| PATCH | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |

#### Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List vendors (filter: `?tier=critical`) |
| GET | `/api/vendors/:id` | Get vendor with incidents |
| POST | `/api/vendors` | Create vendor |
| PATCH | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |

#### Maturity Assessment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/maturity/questions` | Get categories, questions, levels |
| POST | `/api/maturity/assessment` | Create assessment |
| GET | `/api/maturity/assessment/:id` | Get assessment details |
| PATCH | `/api/maturity/assessment/:id` | Update assessment |
| DELETE | `/api/maturity/assessment/:id` | Delete assessment |
| GET | `/api/maturity/history` | List saved assessments |

**Assessment Request:**
```json
{
  "assessmentName": "Q4 2024 Security Assessment",
  "answers": {
    "1": 4,
    "2": 3,
    "3": 5,
    ...
  }
}
```

**Assessment Response:**
```json
{
  "id": "maturity-abc123",
  "overallScore": 3.56,
  "overallPercentage": 71.2,
  "categoryScores": {
    "governance": 3.75,
    "policies": 3.67,
    ...
  },
  "categories": [
    {
      "id": "governance",
      "nameEn": "Governance & Management Commitment",
      "nameAr": "حوكمة ومدى التزام الإدارة بدعم أمن المعلومات",
      "score": 3.75
    },
    ...
  ]
}
```

#### AI Co-pilot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | General chat (FREE) |
| POST | `/api/ai/quick-action` | Predefined GRC prompts |

**Chat Request:**
```json
{
  "message": "What are the key ISO 27001 controls for access management?",
  "context": {
    "currentPage": "controls",
    "riskCount": 12
  }
}
```

#### Supporting APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/business-processes` | List processes |
| GET | `/api/controls` | List controls |
| GET | `/api/compliance` | Framework stats |
| GET | `/api/graph` | Graph visualization data |
| GET | `/api/vendor-incidents` | Vendor incidents |
| POST | `/api/vendor-incidents` | Create incident |

#### Compliance Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compliance/dashboard?mode=` | Multi-framework scores (mode: basic/advanced) |
| GET | `/api/compliance/controls?framework_id=` | Controls with assessments for a framework |
| POST | `/api/compliance/assessment` | Create/update control assessment |
| POST | `/api/compliance/initialize` | Initialize assessments for all ISO controls |
| GET | `/api/compliance/trends?period=` | Trend chart data (period: 3m/6m/12m) |
| POST | `/api/compliance/snapshot` | Create point-in-time score snapshot |

**Dashboard Response:**
```json
{
  "frameworks": [
    { "code": "ISO27001", "score": 84, "implemented": 78, "total": 93 },
    { "code": "NIST_CSF", "score": 61, "implemented": 19, "total": 47 },
    { "code": "PCI_DSS", "score": 68, "implemented": 37, "total": 51 }
  ],
  "domainScores": [
    { "name": "Organizational", "score": 76, "implemented": 28, "total": 37 },
    { "name": "People", "score": 88, "implemented": 7, "total": 8 }
  ],
  "maturityDistribution": { "0": 7, "1": 0, "2": 8, "3": 31, "4": 43, "5": 4 }
}
```

#### Organization Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organization/profile` | Get organization profile |
| POST | `/api/organization/profile` | Update profile (auto-updates framework applicability) |
| GET | `/api/organization/frameworks` | Get framework applicability with reasons |
| POST | `/api/organization/frameworks` | Manually update framework applicability |
| GET | `/api/organization/industry-recommendations` | Get industry-specific framework recommendations |

#### Statement of Applicability

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compliance/soa` | Get SoA with all controls and assessments |
| POST | `/api/compliance/soa` | Update control applicability |
| GET | `/api/compliance/soa/export?format=json` | Export SoA as JSON |
| GET | `/api/compliance/soa/export?format=csv` | Export SoA as CSV |

#### Pentest Pulse Integration (Real-Time Sync)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/external/risks/pentest` | Receive findings from Pentest Pulse |
| GET | `/api/sync/pentest/stats` | Sync statistics (total, by status, by severity) |
| GET | `/api/risks/pentest` | List all pentest-sourced risks |

**Sync Actions:**
```json
// CREATE - New finding synced as risk
{
  "action": "create",
  "risk": { "source_ref": "finding-abc", "title": "SQL Injection", ... }
}

// UPDATE - Existing finding updated
{
  "action": "update", 
  "risk": { "source_ref": "finding-abc", "status": "in_progress", ... }
}

// DELETE - Finding removed
{
  "action": "delete",
  "risk": { "source_ref": "finding-abc" }
}
```

**Data Flow:**
```
Pentest Pulse                    GRCpulse
┌─────────────┐    Real-Time    ┌─────────────┐
│  Finding    │ ──────────────▶ │  Risk Item  │
│  Created/   │   HTTP POST     │  Created/   │
│  Updated    │                 │  Updated    │
└─────────────┘                 └─────────────┘
```

**Risk Source:** All synced risks have `risk_source = 'penetration_test'`

---

## 🗄️ Database Schema

### Entity Relationship

```
organizations (1) ──┬── (*) users
                    ├── (*) business_units ── (*) business_processes
                    ├── (*) assets ── (*) asset_relationships
                    ├── (*) vendors ── (*) vendor_incidents
                    ├── (*) risk_items ── (*) risk_history
                    ├── (*) controls
                    ├── (*) policies
                    ├── (*) maturity_assessments ── (*) maturity_responses
                    └── (*) audit_logs
```

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `organizations` | Multi-tenant root | id, name, slug, industry |
| `users` | User accounts | email, role, status |
| `business_units` | Org structure | name, parent_id, head_user_id |
| `business_processes` | Critical processes | criticality, revenue_impact, rto, rpo |

### Risk Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `risk_items` | Risk register | severity, likelihood, impact, status |
| `risk_history` | Change audit | previous_state, new_state, changed_by |
| `assets` | IT inventory | type, criticality, data_classification |
| `asset_relationships` | Dependencies | source_id, target_id, relationship_type |

### Compliance Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `compliance_frameworks` | Standards | code, version, authority |
| `controls` | Security controls | status, effectiveness, evidence |
| `policies` | Documents | category, version, approval_status |

### Maturity Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `maturity_assessments` | Assessment records | overall_score, status, assessor_id |
| `maturity_responses` | Individual answers | category_id, question_id, current_score |
| `maturity_category_scores` | Category summaries | category_name, current_score, gap_score |

---

## 🚀 Deployment

### Prerequisites

- Node.js 18+
- npm 9+
- Cloudflare account
- Wrangler CLI

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/grc-pulse.git
cd grc-pulse

# Install dependencies
npm install

# Setup local database
npm run db:migrate:local
npm run db:seed

# Build
npm run build

# Start development server
npm run dev:d1

# Or use PM2 (recommended)
pm2 start ecosystem.config.cjs

# Access at http://localhost:3000
```

### Production Deployment

```bash
# 1. Build
npm run build

# 2. Create D1 database (first time only)
npx wrangler d1 create grc-pulse-db

# 3. Update wrangler.jsonc with database ID

# 4. Apply migrations
npm run db:migrate:prod

# 5. Deploy
npm run deploy:prod

# Production URL: https://grc-pulse.pages.dev
```

### Environment Configuration

**wrangler.jsonc:**
```jsonc
{
  "name": "grc-pulse",
  "compatibility_date": "2025-12-24",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "grc-pulse-db",
      "database_id": "your-database-id"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

---

## 📁 Project Structure

```
grc-pulse/
├── src/
│   └── index.tsx          # Main application (Hono + HTML)
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_maturity_assessment.sql
├── docs/
│   └── architecture/
│       ├── SYSTEM_ARCHITECTURE.md
│       ├── DATABASE_SCHEMA.md
│       └── DATABASE_SCHEMA.sql
├── public/
│   └── static/
├── dist/                   # Build output
├── .wrangler/              # Local D1 data
├── package.json
├── wrangler.jsonc
├── vite.config.ts
├── ecosystem.config.cjs    # PM2 configuration
└── README.md
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| Authentication | Email/password with bcrypt hashing |
| Sessions | HTTP-only cookies (XSS protection) |
| RBAC | Role-based access (Admin, Analyst, Viewer) |
| Audit Trail | Complete action logging |
| Data Isolation | Multi-tenant organization scoping |
| Input Validation | Server-side validation on all endpoints |
| CORS | Configured for API routes only |

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Cold Start | < 50ms (Cloudflare Workers) |
| API Response | < 100ms average |
| Build Time | ~3 seconds |
| Bundle Size | ~195 KB |
| Global Edge | 300+ Cloudflare locations |

---

## 🗺️ Roadmap

### Completed ✅

- [x] Authentication & session management
- [x] Executive dashboard with metrics
- [x] Risk register with full CRUD
- [x] Asset management with dependencies
- [x] Vendor risk management
- [x] Compliance control tracking
- [x] Interactive risk graph visualization
- [x] Security maturity assessment (CMM/ISO 27001)
- [x] AI Co-pilot (FREE - Llama 3.1)
- [x] Custom SVG logo with animations
- [x] Cloudflare Pages deployment
- [x] **Pentest Pulse Integration** - Bidirectional sync for findings and assets
- [x] **ISO 27001:2022 Control Library** - 93 controls across 4 themes
- [x] **Cross-Framework Mapping** - ISO → NIST, PCI-DSS, SOC 2, GDPR (150+ mappings)
- [x] **Unified Compliance Dashboard** - Multi-framework scores in one view
- [x] **Gap Assessment UI** - Real-time ISO control assessment
- [x] **Organization Profile** - Industry, region, data types configuration
- [x] **Auto Framework Applicability** - Smart detection based on profile
- [x] **Statement of Applicability (SoA)** - Generator with export
- [x] **Basic/Advanced Scoring Modes** - Dual analysis with maturity weighting
- [x] **Compliance Trend Charts** - Historical score tracking with Chart.js
- [x] **Risk Trend Analysis** - 6-month risk count trends
- [x] **Snapshot API** - Point-in-time compliance recording
- [x] **7-Role RBAC System** - Admin, CISO, Executive, GRC Manager, Auditor, Pentester, Viewer
- [x] **Role-Based Sidebar** - Dynamic menu based on user role permissions
- [x] **Backend API RBAC** - API endpoint protection based on user role
- [x] **User Invitation System** - Secure token-based account activation with password setup
- [x] **Pentester Landing Page** - Dedicated view for pentester role with PentestPulse redirect

### In Progress 🔄

- [ ] Control-to-risk linking
- [ ] AI recommendations for compliance gaps
- [ ] Executive summary report generation

### Planned 🔜

- [ ] Email notifications
- [ ] PDF report generation
- [ ] Custom assessment templates
- [ ] API key authentication
- [ ] Webhook integrations
- [ ] SAML/SSO support
- [ ] Mobile responsive optimization

---

## 📄 License

Proprietary - All rights reserved.

---

## 🤝 Support

For enterprise support and customization:

- **Email**: support@grcpulse.io
- **Documentation**: https://docs.grcpulse.io

---

<p align="center">
  <strong>Built for Enterprise CISOs</strong><br>
  <em>GRC Pulse - Real-time Risk Intelligence</em>
</p>
