# GRC Security Suite — Feature Guide

> A complete, plain-language catalogue of **every feature** across the three
> systems in the GRC Security Suite, what each one does, who can see it, and how
> the pieces fit together. This document complements — it does not replace —
> `README.md` (overview), `ARCHITECTURE.md` (system design),
> `DOCKER_DEPLOYMENT.md` (on-prem), and `SECURITY.md`.

**Last updated:** 2026-08-22

---

## Table of contents

1. [The suite at a glance](#1-the-suite-at-a-glance)
2. [Who it's for](#2-who-its-for)
3. [System 1 — GRC Pulse (Risk & Compliance flagship)](#3-system-1--grc-pulse-risk--compliance-flagship)
4. [System 2 — Pentest Pulse (Pentest Management)](#4-system-2--pentest-pulse-pentest-management)
5. [System 3 — AutoAudit (ISO 27001 AI Artifacts)](#5-system-3--autoaudit-iso-27001-ai-artifacts)
6. [How the three systems connect](#6-how-the-three-systems-connect)
7. [Roles & access control (RBAC)](#7-roles--access-control-rbac)
8. [Compliance frameworks supported](#8-compliance-frameworks-supported)
9. [Deployment models](#9-deployment-models)
10. [Feature index (quick reference)](#10-feature-index-quick-reference)

---

## 1. The suite at a glance

The GRC Security Suite is three integrated products that together cover the
day-to-day of a security & compliance team:

| System | One-liner | Primary users |
|---|---|---|
| **GRC Pulse** | Risk register, compliance/gap management, controls, audit management, vendor risk, and remediation tracking — the operational heart. | CISO, GRC managers, analysts, auditors, executives |
| **Pentest Pulse** | Penetration-test project & finding management with evidence, reports, and OWASP mapping. | Pentesters, security leads |
| **AutoAudit** | AI assistant that drafts ISO 27001 policies, answers GRC questions, and runs a lightweight gap analysis. | Anyone (no login) — bootstrap & advisory |

They are **loosely coupled**: each runs independently, but **Pentest Pulse
findings sync into GRC Pulse** so that real-world exploitable issues flow into
the same compliance score and remediation queue as everything else.

---

## 2. Who it's for

Designed for **small *and* medium companies** — the feature set scales from a
one-person security function up to a small GRC team with separate auditors and
pentesters. Nothing is hidden or "enterprise-locked"; **Audit Management is a
first-class, always-visible capability**, not an add-on.

---

## 3. System 1 — GRC Pulse (Risk & Compliance flagship)

GRC Pulse is a single-page app backed by ~107 API endpoints. Navigation is a
left sidebar grouped into sections; every page is gated by role (see
[§7](#7-roles--access-control-rbac)). Below, each feature is grouped by sidebar
section, with **what it does**, **who sees it**, and the **primary API**.

### 3.1 Overview

#### Dashboard
- **What:** Real-time risk overview — headline KPIs, compliance health score,
  open risks, recent findings, and trend indicators. The landing page after login.
- **Who:** super_admin, org_admin, ciso, executive, grc_manager, viewer
- **API:** `GET /api/dashboard` → returns `complianceHealth` (with the
  risk-weighted `overallScore`, `baseScore`, `riskPenalty` breakdown), risk
  counts, and activity feeds.

#### My Action Items ⭐ *(unified remediation work list)*
- **What:** A single cross-functional list of *everything that needs doing*,
  aggregating three sources into one common shape:
  - **Risks** (`risk_items`) — open/in-progress items with an assignee & due date
  - **Gaps** (`control_assessments`) — controls that aren't implemented yet and
    have remediation work (a plan, an owner, a due date, or a non-`not_started` status)
  - **Audit findings** (`audit_findings`) — open issues from audits
- **Key capabilities:**
  - **Scope toggle** — *All* (whole organisation) vs *Mine* (assigned to me)
  - **Type filter** — risk / gap / finding
  - **Overdue-first sort** with a computed `overdue` flag and `days_until_due`
  - **Inline Assign** — from any row, open a modal to set the **owner**, **due
    date**, **status**, and **remediation plan**; the change is written straight
    to the correct source table (risk → `PATCH /api/risks/:id`, gap →
    `POST /api/compliance/assessment`, finding → `PATCH /api/audit/findings/:id`).
  - **Summary counters** — total, overdue, unassigned, due-soon, and a per-type
    breakdown, plus an **overdue badge** on the sidebar item.
  - **Notification integration** — your overdue & due-soon items also appear at
    the top of the notification bell (see [§3.9](#39-notifications)).
- **Who:** super_admin, org_admin, ciso, executive, grc_manager, security_lead,
  auditor, analyst *(read-only `viewer` and PentestPulse-only `pentester` are
  intentionally excluded — they don't own remediation work).*
- **API:** `GET /api/action-items` with `?mine=1`, `?owner=<id>`,
  `?type=risk|gap|finding`, `?status=all`.

#### Executive Summary
- **What:** A one-page, leadership-oriented GRC snapshot — the numbers a
  board/CISO wants without the operational detail.
- **Who:** super_admin, org_admin, ciso, executive, grc_manager

### 3.2 Risk Management

#### Risk Register (Risks)
- **What:** The full risk inventory — create, score (inherent & residual),
  categorise, assign an owner and due date, attach a remediation plan, and track
  status through its lifecycle (`open → in_progress → mitigated/accepted → closed`).
  Risk scoring uses a 0–100 severity scale (critical ≥75, high ≥50, medium ≥25, low <25).
- **Who:** super_admin, org_admin, ciso, grc_manager
- **API:** `GET/POST/PATCH/DELETE /api/risks`

#### Risk Mitigation
- **What:** Control-to-risk mapping and mitigation tracking — see which controls
  reduce which risks, and follow mitigation progress against target dates.
- **Who:** super_admin, org_admin, ciso, grc_manager

### 3.3 Asset & Vendor (Supply Chain)

#### Assets
- **What:** Asset inventory tied into the risk graph — the "things" (systems,
  data, processes) that risks and controls attach to.
- **Who:** super_admin, org_admin, ciso, grc_manager
- **API:** `GET/POST/PATCH/DELETE /api/assets`

#### Vendors
- **What:** Third-party / supply-chain risk — track vendors, their risk posture,
  and open vendor **incidents** (surfaced as notifications when active).
- **Who:** super_admin, org_admin, ciso, grc_manager
- **API:** `GET/POST/PATCH/DELETE /api/vendors`

### 3.4 Compliance

#### Compliance Dashboard
- **What:** Framework-level compliance posture — how implemented your controls
  are, per framework, driving the risk-weighted compliance score. The score model
  is **Base (implemented ÷ applicable × 100) − risk penalty** (critical −5,
  high −3, medium −1, low −0.5; in-progress at half weight; penalty capped at 40).
- **Who:** super_admin, org_admin, ciso, grc_manager, auditor
- **API:** `GET /api/compliance`, `GET /api/compliance/dashboard`

#### Gap Assessment (ISO 27001:2022 and others)
- **What:** Control-by-control assessment — set each control's
  `implementation_status` (not_started / planned / in_progress / implemented) and
  `maturity_level`, capture a **remediation plan, owner, and due date**, and
  watch the score respond. A one-click **Initialize** can seed demo or empty
  assessments to get started fast.
- **Who:** super_admin, org_admin, ciso, grc_manager, auditor
- **API:** `POST /api/compliance/assessment`, `POST /api/compliance/initialize`

#### Controls
- **What:** The control library browser — 265 controls across 5 frameworks (see
  [§8](#8-compliance-frameworks-supported)) — with per-control detail, framework,
  criticality, linked risks, and the remediation plan/owner section.
- **Who:** super_admin, org_admin, ciso, grc_manager, auditor
- **API:** `GET /api/controls`

#### Organization Settings
- **What:** Configure the org profile and **framework applicability** (which
  frameworks apply to you, so the score is measured against the right denominator).
- **Who:** super_admin, org_admin, ciso, grc_manager

### 3.5 Audit Management *(first-class, always visible)*

#### Audit Dashboard
- **What:** Internal-audit program overview — status of programs, engagements,
  and open findings at a glance.
- **Who:** super_admin, org_admin, ciso, auditor

#### Audit Programs
- **What:** Annual audit **planning** — define the yearly program and track it.
- **Who:** super_admin, org_admin, ciso, auditor

#### Audit Engagements
- **What:** Individual audit **projects** within a program — scope, schedule,
  and progress.
- **Who:** super_admin, org_admin, ciso, auditor

#### Audit Findings
- **What:** Issues & observations raised by audits — severity, status, root
  cause, management response, and a **remediation plan + owner + due date**
  (these feed My Action Items and the compliance score).
- **Who:** super_admin, org_admin, ciso, auditor
- **API:** `GET /api/audit/...`, `PATCH /api/audit/findings/:id`

### 3.6 Intelligence & Analytics

#### AutoAudit (embedded)
- **What:** In-app access to the AutoAudit AI capabilities (policy drafting, GRC
  Q&A, gap analysis) without leaving GRC Pulse.
- **Who:** super_admin, org_admin, ciso, grc_manager, auditor

#### Risk Graph
- **What:** A visual graph of the relationships between assets, risks, controls,
  and processes — see blast-radius and coverage at a glance.
- **Who:** super_admin, org_admin, ciso, grc_manager
- **API:** `GET /api/graph`

#### Maturity
- **What:** Security-program **maturity** scoring/heat-mapping across domains.
- **Who:** super_admin, org_admin, ciso, grc_manager (+ executive via API)
- **API:** `GET /api/maturity`

#### AI Assistant
- **What:** An AI helper for GRC tasks and questions inside the app.
- **Who:** super_admin, org_admin, ciso, grc_manager
- **API:** `GET /api/ai/...`

### 3.7 Administration

#### Organization Admin
- **What:** Manage **users**, module enablement, and org-level settings.
- **Who:** super_admin, org_admin
- **API:** `GET/POST/PUT/DELETE /api/users`, `/api/organization`

#### Super Admin
- **What:** Platform-wide, cross-organization management (the top of the tenancy).
- **Who:** super_admin only
- **API:** `/api/super-admin`

### 3.8 Pentest Pulse launcher
- **What:** A link/landing into Pentest Pulse for the roles that use it. The
  `pentester` role logs straight into a dedicated PentestPulse landing page and
  does **not** get the GRC sidebar.
- **Who:** super_admin, org_admin, ciso, pentester

### 3.9 Notifications
- **What:** The header **bell** aggregates alerts and primes its badge on load.
  It now leads with your **personal** action items:
  - 🔴 *"N of your action items are overdue"*
  - 🟡 *"N of your action items are due soon"* (next 7 days)
  followed by org-wide alerts (high risks, recent audit findings, low/high
  compliance score, active vendor incidents, controls at risk). Each entry
  deep-links to the relevant page (respecting your role's access).
- **API:** `GET /api/notifications`

---

## 4. System 2 — Pentest Pulse (Pentest Management)

Pentest Pulse manages the whole lifecycle of a penetration test — from scoping a
project, through logging findings with evidence, to producing a report — and then
**pushes the results into GRC Pulse**. It is backed by ~45 API endpoints.

### 4.1 Projects
- **What:** The container for an engagement — scope, target org, timeline, status.
  Create, update, list, and delete pentest projects.
- **API:** `GET/POST/PATCH/DELETE /api/projects`, `GET /api/projects/:id`

### 4.2 Findings
- **What:** The core artefact — vulnerabilities discovered during a test. Each
  finding carries a **severity** (critical/high/medium/low), status, description,
  and OWASP category. Findings drive both the report and the downstream GRC sync.
- **Capabilities:** create/update/delete findings; list by project;
  findings-with-evidence view; risk-matrix roll-up.
- **API:** `GET/POST/PATCH/DELETE /api/findings`, `GET /api/findings/:id`,
  `GET /api/findings-with-evidence`, `GET /api/risk-matrix`

### 4.3 Evidence
- **What:** Attach proof to a finding — upload screenshots/files, list evidence
  per finding, view or delete an item. This is what makes a finding defensible
  in a report and an audit.
- **API:** `POST /api/evidence/upload`, `GET /api/findings/:id/evidence`,
  `GET/DELETE /api/evidence/:id`

### 4.4 Assets (scope targets)
- **What:** The systems/hosts in scope for a test, that findings attach to.
- **API:** `GET/POST/PATCH/DELETE /api/assets`

### 4.5 Reports
- **What:** Generate and manage the deliverable — the pentest report built from
  projects, findings, and evidence. Create, update, list, and delete reports.
- **API:** `GET/POST/PATCH/DELETE /api/reports`, `GET /api/reports/:id`

### 4.6 Scanner import
- **What:** Ingest output from vulnerability scanners — parse a scanner file into
  findings so results don't have to be typed in by hand.
- **API:** `POST /api/scanner/parse`

### 4.7 OWASP categories & risk matrix
- **What:** Built-in OWASP category reference and a risk matrix that plots
  findings by likelihood × impact for quick prioritisation.
- **API:** `GET /api/owasp-categories`, `GET /api/risk-matrix`

### 4.8 Organization & users
- **What:** Pentest-side org info and user management (create/update/delete
  pentest users), plus `GET /api/auth/me` for the current session.
- **API:** `GET /api/organization/info`, `GET/POST/PUT/DELETE /api/organization/users`

### 4.9 Sync bridge to GRC Pulse *(the integration engine)*
- **What:** The set of endpoints that push Pentest data into GRC Pulse so
  findings become tracked risks and affect the compliance score:
  - `POST /api/sync/all` — sync everything
  - `POST /api/sync/finding/:id`, `POST /api/sync/asset/:id`, `POST /api/sync/assets`
  - `GET /api/sync/status` — sync health
  - `POST /api/external/sync-org`, `POST /api/external/sync-user` — provisioning
  - `GET /api/external/findings`, `GET /api/external/assets` — the read side GRC pulls from
- **How severity is normalised:** Pentest sends a **0–100 `inherent_score`**
  keyed off severity (critical 95 / high 75 / medium 50 / low 25) plus a
  `pentest_severity`, so GRC's 0–100 severity buckets file the finding correctly
  and closing it actually moves the compliance score. (See [§6](#6-how-the-three-systems-connect).)

---

## 5. System 3 — AutoAudit (ISO 27001 AI Artifacts)

AutoAudit is a lightweight, **login-free** React app (React 18 + Vite) whose
`/api/*` routes are Cloudflare Pages Functions calling **Cloudflare Workers AI
(Llama 3.1)** — so it costs nothing to run on Cloudflare's free tier and needs no
third-party AI key. On on-prem it is backed by Ollama instead. It has three modules:

### 5.1 Policy Generator
- **What:** Generates ISO 27001-aligned **security policies** from a short prompt
  — a fast way to produce a first draft of the documentation an ISMS needs.
- **API:** `POST /api/chat` (policy mode), persisted via `POST /api/policy-session`

### 5.2 AI GRC Consultant
- **What:** A **chat** assistant that answers governance/risk/compliance
  questions in natural language — an on-demand advisor for teams without a
  full-time GRC expert.
- **API:** `POST /api/chat` (consultant mode), sessions via the D1-backed session API

### 5.3 Gap Analysis
- **What:** A guided **ISO 27001:2022 gap analysis** — walk the controls and get
  an AI-assisted view of where you stand and what to fix first. A natural
  on-ramp into the deeper Gap Assessment inside GRC Pulse.

### 5.4 Extras
- **Internationalisation** — includes Arabic (`i18n.js`) alongside English.
- **Session persistence** — chat/policy sessions stored in Cloudflare **D1**.
- **No login** — shareable URL; designed as the friendly front door to the suite.

---

## 6. How the three systems connect

```
   ┌──────────────┐   findings + assets (normalised 0–100 severity)   ┌──────────────┐
   │ Pentest Pulse │ ───────────────  POST /api/sync/*  ────────────▶ │  GRC Pulse   │
   │  (pentesters) │ ◀──── GET /api/external/findings, /assets ─────── │ (risk/comp.) │
   └──────────────┘                                                    └──────┬───────┘
                                                                              │ embeds
   ┌──────────────┐   policies · GRC Q&A · ISO gap analysis                   ▼
   │  AutoAudit    │ ◀──────────  "AutoAudit" page inside GRC Pulse  ────────────
   │ (AI, no login)│
   └──────────────┘
```

- **Pentest → GRC:** Real exploitable findings flow into GRC's risk register and
  therefore into the **same compliance score and My Action Items queue** as gaps
  and audit findings — one remediation backlog, not three. Sync is **idempotent**
  (a second pull creates nothing new) and authenticated with a shared `SYNC_KEY`.
- **AutoAudit ↔ GRC:** AutoAudit is reachable as a page inside GRC Pulse, so the
  AI drafting/advisory sits next to the operational tooling.
- **Shared identity:** Users/orgs can be provisioned across the boundary via the
  `external/sync-org` / `external/sync-user` endpoints.

---

## 7. Roles & access control (RBAC)

Access is enforced in **two layers**, so a role can't reach data even if the UI
were bypassed:

1. **API layer** — `API_PERMISSIONS` gates every `/api/*` endpoint by role.
   *Unlisted API paths default to ALLOW.*
2. **Page layer** — `rolePermissions` gates sidebar/page visibility.
   *Unlisted pages default to DENY.*

### Role vocabulary (11 roles)
`super_admin`, `org_admin`, `ciso`, `executive`, `grc_manager`,
`security_lead`, `analyst`, `auditor`, `pentester`, `viewer`, `vendor`.

### What each role is for
| Role | Purpose |
|---|---|
| **super_admin** | Platform owner — everything, across all orgs. |
| **org_admin** | Owns one organisation — users, modules, settings. |
| **ciso** | Security leadership — full GRC visibility. |
| **executive** | Read-oriented leadership view (dashboard, exec summary, maturity). |
| **grc_manager** | Day-to-day GRC operator — risks, compliance, controls, audit-adjacent. |
| **security_lead** | Operational security lead — remediation ownership. |
| **analyst** | Hands-on contributor — works assigned action items. |
| **auditor** | Audit function — compliance + full Audit Management. |
| **pentester** | PentestPulse-only; lands on a dedicated page, **no GRC sidebar**. |
| **viewer** | Read-only dashboard consumer — no remediation ownership. |
| **vendor** | Third-party/vendor-scoped access. |

### Page → role matrix (GRC Pulse)
| Page | Roles that can see it |
|---|---|
| Dashboard | super_admin, org_admin, ciso, executive, grc_manager, viewer |
| My Action Items | super_admin, org_admin, ciso, executive, grc_manager, security_lead, auditor, analyst |
| Executive Summary | super_admin, org_admin, ciso, executive, grc_manager |
| Risks / Risk Mitigation | super_admin, org_admin, ciso, grc_manager |
| Assets / Vendors | super_admin, org_admin, ciso, grc_manager |
| Compliance / Gap Assessment / Controls | super_admin, org_admin, ciso, grc_manager, auditor |
| Organization Settings | super_admin, org_admin, ciso, grc_manager |
| Audit Dashboard / Programs / Engagements / Findings | super_admin, org_admin, ciso, auditor |
| AutoAudit | super_admin, org_admin, ciso, grc_manager, auditor |
| Risk Graph / Maturity / AI | super_admin, org_admin, ciso, grc_manager |
| Organization Admin | super_admin, org_admin |
| Super Admin | super_admin |
| Pentest Pulse | super_admin, org_admin, ciso, pentester |

---

## 8. Compliance frameworks supported

The control library ships with **265 controls across 5 frameworks**. Each
framework's applicability is configurable per organisation (§3.4), which sets the
denominator for the compliance score.

| Framework | Controls |
|---|---|
| **ISO/IEC 27001:2022** | 93 |
| **PCI-DSS** | 51 |
| **SOC 2** | 48 |
| **NIST CSF** | 47 |
| **GDPR** | 26 |

---

## 9. Deployment models

| Aspect | Cloudflare (production) | On-prem (self-hosted) |
|---|---|---|
| Compute | Cloudflare Pages + Workers | Node server + Docker |
| Database | Cloudflare **D1** (SQLite) | **PostgreSQL** (schemas `grc_pulse`, `pentest_pulse`, `autoaudit`) via a D1→PG adapter |
| AI | Cloudflare **Workers AI** (Llama 3.1) | **Ollama** |
| Auth | JWT (hardened login) | Same, JWT + httpOnly cookie |
| Sync auth | `SYNC_KEY` | `SYNC_KEY` (env-configurable) |

The Cloudflare **production source is treated as immutable**: a default,
env-less build reproduces the production configuration byte-for-byte, and the
on-prem variant is driven entirely by environment variables — so the two targets
share one codebase without diverging. See `DOCKER_DEPLOYMENT.md` and `SETUP.md`.

---

## 10. Feature index (quick reference)

**GRC Pulse:** Dashboard · My Action Items (+ inline Assign) · Executive Summary ·
Risk Register · Risk Mitigation · Assets · Vendors · Compliance Dashboard ·
Gap Assessment · Controls · Organization Settings · Audit Dashboard ·
Audit Programs · Audit Engagements · Audit Findings · AutoAudit (embedded) ·
Risk Graph · Maturity · AI Assistant · Organization Admin · Super Admin ·
Notifications (personal + org).

**Pentest Pulse:** Projects · Findings · Evidence · Assets · Reports ·
Scanner import · OWASP categories · Risk matrix · Org & users · GRC sync bridge.

**AutoAudit:** Policy Generator · AI GRC Consultant · Gap Analysis ·
i18n (Arabic) · D1 session persistence · login-free.

---

*This document reflects the codebase as of the date above. When you add or change
a feature, please update the relevant section here so the guide stays the single
source of truth for "what the suite does."*
