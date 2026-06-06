# Sentient GRC Platform - System Architecture

## Executive Summary

Sentient GRC is an enterprise-grade Governance, Risk, and Compliance platform designed to function as a "Risk Nervous System" for CISOs. It eliminates alert fatigue through context-aware risk scoring and breaks down organizational silos with unified dashboards.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SENTIENT GRC PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         PRESENTATION LAYER                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │  Executive   │  │    Risk      │  │  AI Co-Pilot │  │   Supply    │  │    │
│  │  │  Dashboard   │  │    Graph     │  │   Console    │  │   Chain     │  │    │
│  │  │   (Board)    │  │  Visualizer  │  │  (RFP/Audit) │  │  Monitor    │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  │                                                                          │    │
│  │  Tech: Hono + TypeScript + Tailwind CSS + React Flow (via CDN)          │    │
│  │  Deployment: Cloudflare Pages (Frontend) → Full: Next.js 14 + Shadcn    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                           │
│                                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           API GATEWAY LAYER                              │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │    │
│  │  │                    Kong / AWS API Gateway                         │   │    │
│  │  │  • Rate Limiting  • JWT Validation  • Request Routing            │   │    │
│  │  │  • API Versioning • CORS Management • Request Logging            │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                           │
│           ┌──────────────────────────┼──────────────────────────┐               │
│           ▼                          ▼                          ▼               │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐      │
│  │   CORE SERVICE  │    │    AI MICROSERVICE  │    │  INTEGRATION HUB    │      │
│  │    (NestJS)     │    │     (FastAPI)       │    │     (NestJS)        │      │
│  │                 │    │                     │    │                     │      │
│  │ • Risk Engine   │    │ • LLM Orchestration │    │ • Cloud Connectors  │      │
│  │ • RBAC/Auth     │    │ • RAG Pipeline      │    │   (AWS/Azure/GCP)   │      │
│  │ • Graph Queries │    │ • Embeddings        │    │ • Vendor APIs       │      │
│  │ • Business Logic│    │ • Policy Analysis   │    │ • News/Threat Feeds │      │
│  │ • Audit Logging │    │ • Questionnaire AI  │    │ • SIEM Integration  │      │
│  └────────┬────────┘    └─────────┬───────────┘    └──────────┬──────────┘      │
│           │                       │                           │                  │
│           └───────────────────────┼───────────────────────────┘                  │
│                                   ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           DATA LAYER                                     │    │
│  │                                                                          │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │    │
│  │  │    PostgreSQL    │  │      Neo4j       │  │    Redis Cluster     │   │    │
│  │  │   (Supabase)     │  │   Graph DB       │  │      (Cache)         │   │    │
│  │  │                  │  │                  │  │                      │   │    │
│  │  │ • Users/Orgs     │  │ • Asset→Process  │  │ • Session Store      │   │    │
│  │  │ • Audit Logs     │  │ • Vendor→Risk    │  │ • Query Cache        │   │    │
│  │  │ • Policies       │  │ • Compliance Map │  │ • Real-time Events   │   │    │
│  │  │ • Vector Store   │  │ • Impact Paths   │  │ • Rate Limit State   │   │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │    │
│  │                                                                          │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │    │
│  │  │   S3 / MinIO     │  │   Elasticsearch  │  │    Apache Kafka      │   │    │
│  │  │  (Documents)     │  │    (Search)      │  │   (Event Stream)     │   │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Presentation Layer

**Cloudflare Pages Deployment (This Implementation):**
- Framework: Hono + Vite
- Styling: Tailwind CSS (CDN)
- Visualization: React Flow (CDN), Chart.js
- State: Client-side JavaScript

**Full Production Deployment:**
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS + Shadcn/ui
- Visualization: React Flow, Recharts, D3.js
- State: Zustand + TanStack Query

### 2. Core Service (NestJS)

See `/docs/backend-specs/NESTJS_SERVICE.md` for full specification.

### 3. AI Microservice (FastAPI)

See `/docs/backend-specs/FASTAPI_AI_SERVICE.md` for full specification.

### 4. Integration Hub

See `/docs/backend-specs/INTEGRATION_HUB.md` for full specification.

---

## Security Architecture

### Authentication Flow

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────┐
│  Client  │───▶│  API Gateway │───▶│  Auth Service │───▶│   IdP      │
│          │◀───│             │◀───│              │◀───│ (Okta/AD)  │
└──────────┘    └─────────────┘    └──────────────┘    └────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  JWT + RBAC     │
              │  Validation     │
              └─────────────────┘
```

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| super_admin | Full platform access |
| org_admin | Organization-wide management |
| security_lead | Risk, asset, vendor management |
| analyst | View + limited edit |
| auditor | Read-only access |
| vendor | Vendor portal only |

### OWASP Top 10 Mitigations

| Vulnerability | Mitigation |
|--------------|------------|
| A01:Broken Access Control | RBAC, Row-Level Security, JWT validation |
| A02:Cryptographic Failures | AES-256 encryption, TLS 1.3, HSM for keys |
| A03:Injection | Parameterized queries, ORM, input sanitization |
| A04:Insecure Design | Threat modeling, secure SDLC |
| A05:Security Misconfiguration | Hardened defaults, security headers |
| A06:Vulnerable Components | Automated dependency scanning (Snyk/Dependabot) |
| A07:Auth Failures | MFA, session management, rate limiting |
| A08:Data Integrity Failures | Signed artifacts, integrity checks |
| A09:Logging Failures | Comprehensive audit logging, SIEM integration |
| A10:SSRF | URL validation, network segmentation |

---

## Data Flow

### Risk Contextualization Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Vulnerability│────▶│ Asset       │────▶│ Neo4j       │
│ Scanner     │     │ Enrichment  │     │ Graph Query │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
    ┌──────────────────────────────────────────┘
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Business    │────▶│ Impact      │────▶│ Priority    │
│ Process Map │     │ Calculator  │     │ Scoring     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
    ┌──────────────────────────────────────────┘
    ▼
┌─────────────────────────────────────────────────────┐
│              Context-Aware Alert                     │
│  "Critical: SQL injection on payment-db affects     │
│   Payment Processing ($50K/hr revenue impact)"      │
└─────────────────────────────────────────────────────┘
```

---

## Scalability Strategy

| Component | Scaling Approach |
|-----------|------------------|
| Frontend | CloudFront CDN, Edge caching |
| API Gateway | Horizontal auto-scaling |
| Core Service | Kubernetes HPA (CPU/memory) |
| AI Service | GPU instance scaling (queue-based) |
| PostgreSQL | Read replicas, connection pooling |
| Neo4j | Causal clustering (3+ nodes) |
| Redis | Cluster mode with sharding |

---

## Deployment Environments

| Environment | Purpose | Infrastructure |
|-------------|---------|----------------|
| Development | Local development | Docker Compose |
| Staging | Pre-production testing | Kubernetes (single cluster) |
| Production | Live system | Multi-region Kubernetes |
| DR | Disaster recovery | Passive standby |
