<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Platform-Cloudflare-orange" alt="Platform">
  <img src="https://img.shields.io/badge/ISO-27001:2022-red" alt="ISO 27001">
</p>

# 🛡️ GRC Security Suite

A comprehensive **Governance, Risk, and Compliance (GRC)** platform consisting of three integrated modules for enterprise security management. Built with modern edge technologies for global deployment.

---

## 🎯 Live Demo

| Module | Demo URL | Status |
|--------|----------|--------|
| **AutoAudit** | [autoaudit.pages.dev](https://autoaudit.pages.dev) | ✅ Live |
| **GRC Pulse** | [grcpulse.pages.dev](https://grcpulse.pages.dev) | ✅ Live |
| **Pentest Pulse** | [pentestpulse.pages.dev](https://pentestpulse.pages.dev) | ✅ Live |

---

## 📦 Modules Overview

### 1️⃣ AutoAudit - ISO 27001 Gap Analysis & Policy Generator

<img src="https://img.shields.io/badge/AI-Powered-purple" alt="AI">

**Automated ISO 27001:2022 compliance assessment and policy generation**

| Feature | Description |
|---------|-------------|
| 📋 **Gap Analysis Agent** | AI-powered assessment of all 93 ISO 27001:2022 controls |
| 📄 **Policy Generator** | Automated creation of security policies (ISO/PCI-DSS aligned) |
| 📎 **Evidence Evaluation** | Document upload with smart verification system |
| 📊 **Compliance Scoring** | Real-time compliance percentage with evidence quality metrics |
| 🌐 **Multi-language** | Full English and Arabic support |
| 💾 **Auto-save** | Progress saved to cloud database |

**Key Capabilities:**
- Evaluates organizational, people, physical, and technological controls
- Evidence-based verdicts (Document/Screenshot/Self-Declaration)
- Generates professionally formatted Word documents
- Supports multi-tenant organizations

---

### 2️⃣ GRC Pulse - Risk & Compliance Management

<img src="https://img.shields.io/badge/Enterprise-Grade-blue" alt="Enterprise">

**Centralized risk register and compliance tracking dashboard**

| Feature | Description |
|---------|-------------|
| 🎯 **Risk Register** | Comprehensive risk identification, assessment, and tracking |
| 📈 **Risk Assessment** | Quantitative and qualitative analysis with heat maps |
| 🔄 **Control Mapping** | Link controls to risks and compliance frameworks |
| 📋 **Compliance Tracking** | Monitor status across multiple frameworks |
| 📊 **Executive Dashboards** | Visual metrics for leadership reporting |
| 🔗 **Integration Hub** | Connects with AutoAudit and Pentest Pulse |

**Frameworks Supported:**
- ISO 27001:2022
- NIST CSF
- PCI-DSS
- SOC 2
- Custom frameworks

---

### 3️⃣ Pentest Pulse - Penetration Testing Management

<img src="https://img.shields.io/badge/Security-Testing-red" alt="Security">

**End-to-end penetration testing project management**

| Feature | Description |
|---------|-------------|
| 📝 **Project Management** | Organize pentest engagements with timelines |
| 🎯 **Vulnerability Tracking** | Log, categorize, and track findings |
| 📊 **CVSS Scoring** | Automated severity calculation (CVSS 3.1) |
| 📄 **Report Generation** | Professional pentest reports |
| 🔁 **Remediation Workflow** | Track fix status and retesting |
| 🔗 **GRC Integration** | Push findings directly to GRC Pulse risk register |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      GRC Security Suite                          │
├───────────────────┬───────────────────┬─────────────────────────┤
│    AutoAudit      │     GRC Pulse     │     Pentest Pulse       │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌─────────────────┐    │
│  │ Gap Analysis│  │  │Risk Register│  │  │ Project Mgmt    │    │
│  │ Policy Gen  │  │  │ Compliance  │  │  │ Vuln Tracking   │    │
│  │ Evidence    │  │  │ Dashboards  │  │  │ CVSS Scoring    │    │
│  └─────────────┘  │  └─────────────┘  │  └─────────────────┘    │
├───────────────────┴───────────────────┴─────────────────────────┤
│                    Hono Framework (API Layer)                    │
├─────────────────────────────────────────────────────────────────┤
│                 Cloudflare Workers AI (Llama 3.1)                │
├─────────────────────────────────────────────────────────────────┤
│                   Cloudflare D1 (SQLite Database)                │
├─────────────────────────────────────────────────────────────────┤
│                   Cloudflare Pages (Global CDN)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, TailwindCSS |
| **Backend** | Hono (Cloudflare Workers) |
| **AI** | Cloudflare Workers AI (Llama 3.1 8B) |
| **Database** | Cloudflare D1 (SQLite) |
| **Hosting** | Cloudflare Pages |
| **Build** | Vite |

---

## 🚀 Deployment Options

### Option 1: Cloudflare Pages (Recommended)

Each module deploys independently to Cloudflare's global edge network.

```bash
# Deploy AutoAudit
cd autoaudit
npm install
npm run build
wrangler pages deploy dist

# Deploy GRC Pulse
cd grc-pulse
npm install
npm run build
wrangler pages deploy dist

# Deploy Pentest Pulse
cd pentest-pulse
npm install
npm run build
wrangler pages deploy dist
```

### Option 2: Self-Hosted / On-Premise

```bash
# Clone repository
git clone https://github.com/gamosec/grc-security-suite.git
cd grc-security-suite

# Build all modules
cd autoaudit && npm install && npm run build
cd ../grc-pulse && npm install && npm run build
cd ../pentest-pulse && npm install && npm run build

# Deploy dist/ folders to your web server
```

### Option 3: Docker (Coming Soon)

```bash
docker-compose up -d
```

---

## 📁 Project Structure

```
grc-security-suite/
│
├── autoaudit/                    # ISO 27001 Gap Analysis & Policy Generator
│   ├── src/
│   │   ├── modules/
│   │   │   ├── GapModule.jsx     # 93-control assessment engine
│   │   │   ├── PolicyModule.jsx  # Policy document generator
│   │   │   └── ConsultantModule.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── functions/                # Cloudflare Workers API
│   │   └── api/
│   │       ├── chat.js           # AI chat endpoint
│   │       └── session.js        # Session management
│   ├── package.json
│   └── wrangler.jsonc
│
├── grc-pulse/                    # Risk & Compliance Management
│   ├── src/
│   │   ├── index.tsx             # Hono API routes
│   │   └── data/
│   ├── migrations/               # D1 database schemas
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_maturity_assessment.sql
│   │   └── ...
│   ├── package.json
│   └── wrangler.jsonc
│
├── pentest-pulse/                # Penetration Testing Management
│   ├── src/
│   │   └── index.tsx             # Hono API routes
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   ├── grcpulse-integration/     # GRC Pulse connector
│   ├── package.json
│   └── wrangler.jsonc
│
├── LICENSE                       # MIT License
└── README.md                     # This file
```

---

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account (free tier works)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/gamosec/grc-security-suite.git
cd grc-security-suite

# Start AutoAudit
cd autoaudit
npm install
npm run dev
# Open http://localhost:5173

# Start GRC Pulse (new terminal)
cd grc-pulse
npm install
npm run dev
# Open http://localhost:5174

# Start Pentest Pulse (new terminal)
cd pentest-pulse
npm install
npm run dev
# Open http://localhost:5175
```

---

## 📋 Database Setup

Each module uses Cloudflare D1 (SQLite). Create databases:

```bash
# Create databases
wrangler d1 create autoaudit-db
wrangler d1 create grcpulse-db
wrangler d1 create pentestpulse-db

# Run migrations
cd grc-pulse
wrangler d1 migrations apply grcpulse-db --local

cd ../pentest-pulse
wrangler d1 migrations apply pentestpulse-db --local
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|----------------|
| **Data Encryption** | Cloudflare D1 encryption at rest |
| **Transport Security** | HTTPS enforced via Cloudflare |
| **API Protection** | Cloudflare Workers edge security |
| **Session Management** | Secure cookie-based sessions |
| **Multi-tenancy** | Organization-scoped data isolation |
| **No Client Secrets** | All sensitive operations server-side |

---

## 🌐 Integration Flow

```
┌──────────────┐     Findings      ┌──────────────┐
│              │ ───────────────►  │              │
│ Pentest Pulse│                   │  GRC Pulse   │
│              │ ◄───────────────  │              │
└──────────────┘   Risk Updates    └──────────────┘
                                          │
                                          │ Compliance
                                          │ Status
                                          ▼
                                   ┌──────────────┐
                                   │  AutoAudit   │
                                   │ Gap Analysis │
                                   └──────────────┘
```

---

## 📊 Compliance Frameworks

| Framework | AutoAudit | GRC Pulse | Status |
|-----------|-----------|-----------|--------|
| ISO 27001:2022 | ✅ Full 93 controls | ✅ Control mapping | Production |
| PCI-DSS | ✅ Policy templates | ✅ Compliance tracking | Production |
| NIST CSF | 🔄 Planned | ✅ Framework support | Partial |
| SOC 2 | 🔄 Planned | ✅ Framework support | Partial |
| GDPR | 🔄 Planned | 🔄 Planned | Roadmap |

---

## 🗺️ Roadmap

- [ ] Docker deployment support
- [ ] NIST CSF gap analysis
- [ ] SOC 2 assessment module
- [ ] Executive PDF reports
- [ ] API documentation (OpenAPI)
- [ ] LDAP/SSO integration
- [ ] Custom framework builder
- [ ] Mobile responsive improvements

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**gamosec**

- GitHub: [@gamosec](https://github.com/gamosec)

---

## 🙏 Acknowledgments

- Cloudflare for Workers AI and D1 database
- Hono framework team
- ISO 27001:2022 standard documentation
- Open source security community

---

<p align="center">
  Made with ❤️ for the security community
</p>
