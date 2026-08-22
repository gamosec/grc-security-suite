# GRC Pulse — RBAC Access Matrix

This document is the authoritative reference for **who can access what** in GRC Pulse.
It is generated from (and must stay in sync with) the two permission maps in
`grc-pulse/src/index.tsx`:

- **API layer** — `API_PERMISSIONS` (≈ line 172). Gates every `/api/*` endpoint
  via `hasApiAccess()`. Matched **by path prefix** (e.g. a rule for
  `/api/organization` also covers `/api/organization/profile` and
  `/api/organization/frameworks`).
- **Page / sidebar layer** — `rolePermissions` inside `getMainPage()` (≈ line 4569).
  Gates page and sidebar-item visibility via `hasAccess(page)`.

> **Default behaviour (important):**
> - An **API path that is not listed** in `API_PERMISSIONS` defaults to **ALLOW**
>   (any authenticated user).
> - A **page that is not listed** in `rolePermissions` defaults to **DENY**.
>
> Because of this asymmetry, a page and its backing API must be kept aligned:
> if a page is visible but its API denies the role, the user lands on a broken
> (403) page. See **Resolved consistency issues** below.

Legend: **Y** = allowed · **.** = denied.

---

## 1. The 11 roles

| Role | Intended persona |
|---|---|
| `super_admin` | Platform operator — manages **all** organizations. |
| `org_admin` | Organization administrator — full control of their own org. |
| `ciso` | Security executive — broad oversight across risk, compliance, audit, pentest. |
| `executive` | Board / C-suite — high-level read-only summaries. |
| `grc_manager` | Day-to-day GRC owner — risk, compliance, assets, vendors, intelligence. |
| `security_lead` | Operational security lead — remediates risks/gaps, owns action items. |
| `analyst` | Operational analyst — same operational surface as `security_lead`. |
| `auditor` | Internal/external auditor — audit workspace + read compliance/risk. |
| `pentester` | Pentest Pulse specialist — pentest sync + Pentest Pulse app only. |
| `viewer` | Read-only stakeholder — dashboard only. |
| `vendor` | External vendor — minimal read-only dashboard only. |

---

## 2. Page / sidebar access matrix

| Page | super_admin | org_admin | ciso | executive | grc_manager | security_lead | analyst | auditor | pentester | viewer | vendor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `super-admin` | Y | . | . | . | . | . | . | . | . | . | . |
| `dashboard` | Y | Y | Y | Y | Y | Y | Y | . | . | Y | Y |
| `action-items` | Y | Y | Y | Y | Y | Y | Y | Y | . | . | . |
| `executive-summary` | Y | Y | Y | Y | Y | . | . | . | . | . | . |
| `risks` | Y | Y | Y | . | Y | Y | Y | . | . | . | . |
| `risk-mitigation` | Y | Y | Y | . | Y | Y | Y | . | . | . | . |
| `assets` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `vendors` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `compliance` | Y | Y | Y | . | Y | Y | Y | Y | . | . | . |
| `gap-assessment` | Y | Y | Y | . | Y | Y | Y | Y | . | . | . |
| `controls` | Y | Y | Y | . | Y | Y | Y | Y | . | . | . |
| `org-settings` | Y | Y | . | . | . | . | . | . | . | . | . |
| `audit-dashboard` | Y | Y | Y | . | . | . | . | Y | . | . | . |
| `audit-programs` | Y | Y | Y | . | . | . | . | Y | . | . | . |
| `audit-engagements` | Y | Y | Y | . | . | . | . | Y | . | . | . |
| `audit-findings` | Y | Y | Y | . | . | . | . | Y | . | . | . |
| `autoaudit` | Y | Y | Y | . | Y | . | . | Y | . | . | . |
| `graph` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `maturity` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `ai` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `org-admin` | Y | Y | . | . | . | . | . | . | . | . | . |
| `pentest-pulse` | Y | Y | Y | . | . | . | . | . | Y | . | . |

**Pages granted per role:**
super_admin **22** · org_admin **21** · ciso **19** · executive **3** ·
grc_manager **14** · security_lead **7** · analyst **7** · auditor **9** ·
pentester **1** · viewer **1** · vendor **1**.

---

## 3. API endpoint access matrix

> Only endpoints listed in `API_PERMISSIONS` are shown. Any `/api/*` path **not**
> listed here defaults to **ALLOW** for any authenticated user.

| API endpoint (prefix) | super_admin | org_admin | ciso | executive | grc_manager | security_lead | analyst | auditor | pentester | viewer | vendor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/api/dashboard` | Y | Y | Y | Y | Y | Y | Y | . | . | Y | Y |
| `/api/risks` | Y | Y | Y | Y | Y | Y | Y | Y | . | . | . |
| `/api/assets` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/vendors` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/business-processes` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/compliance` | Y | Y | Y | Y | Y | Y | Y | Y | . | . | . |
| `/api/controls` | Y | Y | Y | . | Y | Y | Y | Y | . | . | . |
| `/api/graph` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/maturity` | Y | Y | Y | Y | Y | . | . | . | . | . | . |
| `/api/ai` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/audit` | Y | Y | Y | . | . | . | . | Y | . | . | . |
| `/api/action-items` | Y | Y | Y | Y | Y | Y | Y | Y | . | . | . |
| `/api/users` | Y | Y | Y | . | Y | . | . | . | . | . | . |
| `/api/organization` | Y | Y | . | . | . | . | . | . | . | . | . |
| `/api/super-admin` | Y | . | . | . | . | . | . | . | . | . | . |
| `/api/sync/pentest` | Y | Y | Y | . | . | . | . | . | Y | . | . |
| `/api/external/risks/pentest` | Y | Y | Y | . | . | . | . | . | Y | . | . |
| `/api/risks/pentest` | Y | Y | Y | . | . | . | . | . | Y | . | . |

---

## 4. Per-role summary (what a new user of each role actually gets)

- **super_admin** — Everything, including the platform-wide Super Admin console
  and org management. Use for the platform operator only.
- **org_admin** — Everything inside their own organization: risk, compliance,
  audit, intelligence, org settings, user management, Pentest Pulse.
- **ciso** — Broad oversight: dashboards, action items, risk, compliance, assets,
  vendors, the full audit workspace, AutoAudit, intelligence (graph/maturity/ai),
  and Pentest Pulse. **Not** org settings (that is admin-only — see Issue #3).
- **executive** — Read-only leadership view: dashboard, action items, executive
  summary. Backed by read access to `/api/dashboard`, `/api/risks`,
  `/api/compliance`, `/api/maturity`, `/api/action-items`.
- **grc_manager** — Operational GRC owner: risk, compliance, assets, vendors,
  action items, AutoAudit, and intelligence. No audit workspace, no org settings.
- **security_lead** — Operational security lead. Lands on a working operational
  set: **dashboard, risks, risk-mitigation, compliance, gap-assessment, controls,
  action-items** (7 pages), each with matching API access.
- **analyst** — Same operational surface as `security_lead` (7 pages).
- **auditor** — Audit-first: the four audit pages, AutoAudit, plus read access to
  compliance/gap/controls and action items, and read access to `/api/risks`.
- **pentester** — Pentest Pulse app + pentest sync endpoints only.
- **viewer** — Dashboard only (read-only stakeholder).
- **vendor** — Dashboard only (minimal external read-only landing).

---

## 5. Resolved consistency issues

A full page-vs-API review of all 11 roles surfaced three issues, all fixed in the
same commit that produced this matrix:

1. **`security_lead` was a login dead-end (1 page).** The role could authenticate
   but only saw `action-items`, with no operational surface.
   **Fix:** granted the operational page set (dashboard, risks, risk-mitigation,
   compliance, gap-assessment, controls) plus matching API access
   (`/api/dashboard`, `/api/risks`, `/api/compliance`, `/api/controls`) — bringing
   it in line with `analyst`.

2. **`vendor` had zero pages (empty app).** A new vendor user would log in to a
   blank application.
   **Fix (option a):** granted a **minimal read-only dashboard** only
   (`dashboard` page + `/api/dashboard`).

3. **`org-settings` page was visible to `ciso`/`grc_manager` but its API denied
   them.** The Organization Settings page fetches `/api/organization/*`
   (profile, frameworks), which is restricted to `super_admin`/`org_admin`, so
   `ciso`/`grc_manager` hit a broken (403) page.
   **Fix:** restricted the `org-settings` **page** to `super_admin`/`org_admin`
   to match the API.

### Post-fix verification
- **Issue class 1** (page visible but backing API denies the role): **none remaining.**
- **Issue class 2** (roles with zero accessible pages): **none remaining.**
- Full local test suite: **20 / 20 passing.**

---

## 6. Guidance for adding / changing roles

When you change a role's access, **always update both maps together**:

1. If you make a **page** visible to a role, confirm the endpoint(s) that page
   calls are also allowed for that role in `API_PERMISSIONS` (remember prefix
   matching and the ALLOW-by-default for unlisted API paths).
2. If you restrict an **API** endpoint, confirm no page remains visible to a role
   that the endpoint now denies (or the role gets a 403 page).
3. Re-run the consistency check and the test suite before committing.

The role vocabulary is fixed by a DB `CHECK` constraint (the 11 roles above); do
not introduce a role name outside that list without also updating the constraint.
