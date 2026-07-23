# 07 — EXACT FORM FILL (Black Hat MEA portal)  ★ COMPLETE-SUITE VERSION

> This version tells the WHOLE story: the three connected systems (AutoAudit +
> GRC Pulse + Pentest Pulse), how the security team works together, and how
> EVERY input — an auditor's non-conformity, a GRC self-assessment risk, a
> pentester's finding — flows into ONE live compliance score, plus the real
> benefit/outcome for the team.
>
> Fields matched to the real portal:
> Session Title ≤20 · Session Overview ≤250 · Session Outcomes ≤100 ·
> New research/concept ≤200. All texts below are verified under limit.

---

## FIELD 1 — Session Title  (limit: 20 words)

### ✅ RECOMMENDED (15 words)
```
GRC Security Suite: One Live Compliance Score From Audit, Risk and Pentest, In Real Time
```

### Alternatives (all under 20 words)
- **A (13):** `GRC Security Suite: How Audit, Risk and Pentest Feed One Live Compliance Score`
- **B (12):** `One Living Compliance Score: Integrating Audit, Risk and Penetration Testing for Any Regulator`
- **C (14):** `GRC Pulse: The Live Compliance Score Your Auditors, Analysts and Pentesters All Move`

---

## FIELD 2 — Category (dropdown)
Pick the closest: **Governance, Risk & Compliance (GRC)** → else Security/Risk
Management → else Defense/Blue Team → else Emerging/Innovation.
(Send me the dropdown options and I'll choose the exact one.)

---

## FIELD 3 — Session Overview  (limit: 250 words)

### ✅ PASTE THIS (225 words)
```
Security teams run governance, audit, risk, and penetration testing in separate tools, then try to reconcile them into a compliance number once a quarter. By the time the spreadsheet is signed, it is already wrong. This session presents the GRC Security Suite, an open, integrated GRC platform (MVP/POC) built around three connected systems: AutoAudit for ISO 27001 audit and gap analysis, GRC Pulse for risk and compliance management, and Pentest Pulse for penetration-test and findings management.

The whole security team works together on one fabric. When an auditor raises a non-conformity, when a GRC analyst logs a risk during a self-assessment, or when a pentester reports a finding, every one of these events flows into GRC Pulse and updates a single, live, risk-adjusted compliance score in real time. After controls are implemented and assessed, the base compliance score rises; when new risks or findings open, the score is reduced by weighted deductions; when they are remediated, it recovers.

We show how the score is calculated so it is explainable and auditable, how findings map to controls and then to many regulators at once (ISO 27001, SOC 2, GDPR, NIST CSF, PCI-DSS), and we prove it live: open a critical finding and the score drops from 52 to 47; remediate it and it returns to 52. Attendees leave with a repeatable model and an open platform.
```

---

## FIELD 4 — Session Outcomes  (limit: 100 words)

### ✅ PASTE THIS (99 words)
```
Attendees will understand how an integrated GRC suite connects audit, risk, and penetration testing into one workflow, and how every input, an auditor non-conformity, a GRC self-assessment risk, or a pentester finding, changes a single live compliance score. They will be able to design a compliance program where the score is continuous rather than a quarterly snapshot, explain any score to an auditor because every point is traceable to evidence, map one finding to many regulators at once, and prioritise remediation by its real impact on compliance. They also gain access to an open MVP platform to try themselves.
```

---

## FIELD 5 — What new research, concept, technique or approach is included?  (limit: 200 words)

### ✅ PASTE THIS (184 words)
```
The new approach is treating governance, audit, risk, and offensive testing as one continuous compliance system rather than four disconnected activities reconciled quarterly. Three concrete contributions support this:

First, a unified live scoring pipeline: control implementation and assessment set a base score, then risks from every source, audit non-conformities, GRC self-assessments, vulnerability scans, vendor reviews, and pentest findings, apply weighted deductions, so the compliance score reflects true posture in real time and recovers automatically as issues are remediated.

Second, an explainable Weighted Deduction model: severity-weighted deductions (critical, high, medium, low), in-progress items at half weight, bounded by a cap, computed by one shared function so the number is identical and auditable across every dashboard.

Third, a framework-agnostic mapping engine: a finding maps to controls, controls map to requirements, so one issue scores ISO 27001, SOC 2, GDPR, NIST CSF and PCI-DSS simultaneously, and adding a regulator means adding a mapping table.

All of this runs on a real working platform, on-premises or at the edge, and is proven live: a critical finding drops the score from 52 to 47, remediation restores it to 52.
```

---

## Reference: how the complete suite works (for your talk + Q&A)

**Three connected systems, one security team:**

| System | Who uses it | What it produces |
|--------|-------------|------------------|
| **AutoAudit** | Auditors / ISO 27001 leads | Gap analysis, audit findings, **non-conformities (NCs)** |
| **GRC Pulse** (hub) | GRC analysts, CISO, compliance | Risk register, control assessments, **the live compliance score** |
| **Pentest Pulse** | Red team / pentesters | Penetration-test projects, assets, **security findings** |

**How the live score reacts — every input path (all real in the platform):**

1. **Auditor finds a non-conformity** → logged as an `audit_finding` risk in GRC
   Pulse → weighted deduction → **score drops**.
2. **GRC analyst runs a self-assessment** and adds a risk → `self_assessment`
   risk → deduction → **score drops**.
3. **Pentester reports a finding** in Pentest Pulse → syncs into GRC Pulse as a
   `penetration_test` risk (normalized 0–100 severity) → deduction → **score drops**.
4. **Team implements & assesses a control** → implemented/applicable ratio rises
   → **base score rises**.
5. **Any risk/finding is remediated or closed** → its deduction disappears →
   **score recovers**.

> The score = **(control coverage base) − (severity-weighted open risk from ALL
> sources), capped**. One shared formula, every source, one live number, mapped
> to every regulator.

**The benefit / outcome for the organization:**
- Compliance becomes **continuous**, not a once-a-year audit scramble.
- The score is **defensible** — you can show an auditor exactly which finding
  cost which points.
- **One finding, many regulators** — no re-entering the same issue per framework.
- **Prioritise remediation by compliance impact** — fix what moves the score most.
- **Self-hostable** (on-prem PostgreSQL/Docker) for regulated/air-gapped orgs.

---

## Notes
- MVP/POC framed honestly throughout.
- Everything demoed is reproducible (52 → 47 → 52).
- Not a product pitch — methodology + open tool.
