# 01 — Submission Form (copy-paste answers)

> Paste these into the Black Hat MEA Briefings portal fields. Two title options,
> two abstract lengths (portals usually cap abstracts ~150–300 words), and all
> supporting fields. Pick the variant that fits each field's limit.

---

## TRACK
**Briefings (Call for Papers)** — Governance, Risk & Compliance / Security Operations
Secondary (if a Tools/Arsenal form is available): **Arsenal / Call for Tools**

## SESSION LENGTH
**40 minutes** (preferred — includes a 10-minute live demo)
Fallback: 20 minutes (demo trimmed to the core score-movement moment)

## PRESENTERS
Up to 2. Primary presenter + optional co-presenter (see `06_SPEAKER_BIO.md`).

---

## TITLE (option A — recommended)
**"The Compliance Score Is Lying: Building a Live, Framework-Agnostic GRC Score That Moves When Your Findings Do"**

## TITLE (option B — punchier / tool-forward)
**"GRC Security Suite: A Live Compliance Score for Every Regulator — Watch It Move On Stage"**

## TITLE (option C — problem-forward)
**"From Findings to Defensible Numbers: Real-Time Compliance Mapping & Scoring Across ISO 27001, SOC 2, GDPR, NIST & PCI"**

---

## SHORT ABSTRACT (≈120 words — for tight fields)

Most GRC platforms display a compliance percentage that is really a static
checklist snapshot — stale the moment it's signed, and blind to what the
security team actually found this week. We present the **GRC Security Suite**,
an open, integrated GRC platform (MVP/POC) where pentest and audit findings flow
in real time into a **risk-adjusted compliance score** that updates the instant
a finding is opened or remediated. We break down the **Weighted Deduction
scoring model**, the **severity-scale normalization pitfall** that silently
breaks most tool integrations (1–25 vs 0–100), and a **framework-agnostic
mapping engine** that lets one finding affect ISO 27001, SOC 2, GDPR, NIST CSF
and PCI-DSS simultaneously. Live on stage, we open a critical finding and watch
the score fall — then close it and watch it recover.

---

## LONG ABSTRACT (≈260 words — for standard fields)

Ask any CISO for their compliance score and you'll get a number. Ask *why* it's
that number, or what happens to it when the red team closes a critical finding,
and the answer is usually a spreadsheet, a quarter-old audit, and a shrug.
Compliance scoring in most GRC tools is a **static checklist percentage**: it
ignores live risk, it's stale the moment it's signed, and it can't be traced
back to the evidence that produced it.

This Briefing presents the **GRC Security Suite** — an open, integrated GRC
platform (currently MVP/POC) where an entire security team works across two
connected systems: **Pentest Pulse** (penetration-test & findings management)
and **GRC Pulse** (risk & compliance). Findings sync between them and drive a
**living, risk-adjusted compliance score** that moves in real time.

We go deep on three things reviewers can verify:

1. **The scoring model** — a Weighted Deduction approach where a control-coverage
   base score is reduced by open risks weighted by severity, with in-progress
   items at half weight and a bounded cap, producing a defensible, explainable
   number.
2. **The integration bug almost everyone ships** — a severity **scale mismatch**
   (1–25 likelihood×impact vs 0–100 buckets) that silently files critical
   findings as "low," so closing them never moves the score. We show the fix.
3. **Framework-agnostic mapping** — one finding, mapped once, affecting ISO
   27001, SOC 2, GDPR, NIST CSF and PCI-DSS at the same time, extensible to any
   regulator.

We finish **live**: open a critical finding, watch the score drop 52→47; close
it, watch it recover 52 — deterministic, reproducible, and auditable.

---

## KEY TAKEAWAYS (bullet field)

- Why static compliance percentages are misleading, and what a *defensible*
  score looks like.
- A concrete, explainable **risk-weighted scoring model** you can adopt.
- The **severity-scale normalization pitfall** that breaks tool-to-GRC
  integrations — how to detect and fix it.
- A **framework-agnostic control-mapping** pattern: map a finding once, satisfy
  many regulators.
- How to architect a GRC platform that runs both **on-prem (PostgreSQL/Docker)**
  and at the **edge (Cloudflare)** from a single codebase.

---

## WHO SHOULD ATTEND / AUDIENCE

CISOs, GRC managers, compliance officers, security engineers, red/blue team
leads, and builders of security tooling. Value for both **practitioners** (how
to score honestly) and **builders** (how to architect the integration).

## PREREQUISITE KNOWLEDGE
Basic familiarity with compliance frameworks (ISO 27001 / SOC 2 concepts) and
penetration-testing workflow. No coding required to follow.

## WHAT'S NEW / ORIGINALITY STATEMENT
This is **original, unpublished work**. The scoring model, the scale-mismatch
analysis, and the multi-framework mapping engine are our own. The platform is a
**working MVP/POC** with an automated test suite, not a concept or vendor demo.

## SUPPORTING MATERIALS
- Whitepaper: `03_WHITEPAPER_problem_and_method.md` (attach as PDF)
- Live demo runbook: `04_LIVE_DEMO_SCRIPT.md`
- Public repository (open source): GRC Security Suite

## IS THIS A PRODUCT PITCH?
No. It is a methodology + open platform talk. No pricing, no sales. The tool is
demonstrated to prove the technique, and is available for the community.

## ETHICS / DISCLOSURE
No third-party vulnerabilities are disclosed. All findings shown are synthetic
demo data in two fictional organizations (Acme Corporation, Almadar).
