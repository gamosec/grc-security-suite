# 03 — Whitepaper (supporting material)
## Living Compliance: Real-Time, Framework-Agnostic Risk-to-Compliance Scoring

**Authors:** GRC Security Suite team
**Status:** MVP / Proof-of-Concept · working platform with automated test suite
**Prepared for:** Black Hat MEA 2025 Briefings submission
**Abstract:** We describe the problem of stale, unexplainable compliance scores;
a severity **scale-normalization** failure that silently breaks tool-to-GRC
integrations; a **Weighted Deduction** scoring model that produces a live,
bounded, explainable compliance number; and a **framework-agnostic mapping
engine** that lets one finding affect multiple regulators simultaneously.

---

## 1. Problem statement

### 1.1 What organizations actually need
A security team needs to answer, at any moment: *"Given everything we know right
now — controls we've implemented, findings the pentest team just logged, risks
the audit team is tracking — how compliant are we with each regulation, and
why?"*

### 1.2 Why current practice fails
- **Point-in-time snapshots.** Compliance is measured at audit time and treated
  as valid for a quarter or a year. Reality changes daily.
- **Checklist scores.** A percentage of "controls marked implemented" ignores
  *live risk*. You can be "95% compliant" with a critical vulnerability open.
- **No traceability.** The number can't be explained: which finding, which
  control, which requirement produced it?
- **Framework silos.** The same finding must be re-entered per framework; there
  is no single source of truth mapping one issue to ISO 27001 **and** SOC 2
  **and** GDPR **and** NIST CSF **and** PCI-DSS.
- **Disconnected tools.** Pentest tooling and GRC tooling rarely reconcile, so
  the compliance score never reflects offensive findings.

### 1.3 The thesis
A compliance score should be **living** (updates as posture changes),
**explainable** (traceable to evidence), **bounded** (robust to noise), and
**framework-agnostic** (one model, many regulators).

---

## 2. System overview

The **GRC Security Suite** is an integrated platform with two connected apps and
one shared integration fabric:

| System | Role |
|--------|------|
| **Pentest Pulse** | Penetration-test projects, assets, and **findings** management |
| **GRC Pulse** | **Risk** register, control assessments, framework compliance, scoring (the hub) |
| **AutoAudit** | ISO 27001 audit automation |

**Data flow:** `Pentest finding → normalized sync → GRC risk → control mapping →
framework requirement → compliance score.`

A full security team operates across both apps: red team logs findings in
Pentest Pulse; GRC/compliance team watches risk and the compliance score move in
GRC Pulse — **the "live GRC track."**

---

## 3. The integration pitfall: severity scale mismatch

### 3.1 The bug pattern
When connecting an offensive tool to a GRC system, the two sides usually score
severity on **different scales**:

- **Pentest side:** `risk = likelihood × impact`, each on 1–5 → a **1–25** scale
  (critical ≈ 25).
- **GRC side:** severity is bucketed on a **0–100** scale:

  | Bucket | Range |
  |--------|-------|
  | Critical | ≥ 75 |
  | High | ≥ 50 |
  | Medium | ≥ 25 |
  | Low | < 25 |

### 3.2 The silent failure
A **critical** finding (score 25 on the 1–25 scale) crosses the boundary and is
read as **25 on the 0–100 scale → "medium"/"low."** It contributes ~0 to any
severity-weighted score. Consequence: **closing a critical finding never changes
the compliance score.** The dashboard appears healthy and is quietly wrong — the
worst kind of bug in a governance tool.

### 3.3 The fix: normalize at the boundary
Normalize severity to a **canonical 0–100** value at the integration edge, keyed
off the categorical severity (not the raw arithmetic), and carry the categorical
label explicitly:

```
critical → 95   high → 75   medium → 50   low → 25   informational → 10
```

Design rules:
1. Never let a raw `likelihood × impact` value leak across a boundary that
   expects a different scale.
2. Always carry both the **categorical severity** and a **canonical numeric
   score**; the receiver should be able to reconstruct the bucket from either.
3. Make the normalization **explicit and testable** (see §6).

---

## 4. The Weighted Deduction scoring model

### 4.1 Definition
```
Base Score  = (implemented controls / applicable controls) × 100

Risk Deduction = Σ over each OPEN or IN_PROGRESS risk, by severity:
                   Critical −5 · High −3 · Medium −1 · Low −0.5
                 IN_PROGRESS risks contribute at HALF weight
                 total deduction capped at 40

Final Score = max(0, round(Base Score − Risk Deduction))
```

### 4.2 Rationale for each design decision
- **Base from control coverage** captures the *governance* dimension: what have
  we actually implemented?
- **Deduction from live risk** injects *reality*: what's currently broken?
- **Severity weights (5/3/1/0.5)** make critical findings dominate without
  letting a swarm of lows overwhelm the signal.
- **In-progress at half weight** rewards remediation *in motion* — a risk being
  actively fixed hurts less than an untouched one, incentivizing action.
- **Cap at 40** preserves signal: a single bad month cannot drive the score to
  zero and destroy the ability to distinguish states.
- **`max(0, …)`** keeps the score in a sane, communicable 0–100 range.

### 4.3 Only open/in-progress risks deduct
Any risk that is closed, mitigated, accepted, or transferred **stops
contributing**. This is what makes remediation *immediately* visible: fix a
finding → its deduction disappears → the score rises on the next sync.

### 4.4 One shared function, everywhere
A single `computeComplianceScore()` / `computeRiskDeduction()` pair feeds the
main dashboard, the compliance dashboard, and the executive summary. This
guarantees the number is **identical across every view** and is **auditable** —
there is exactly one place where the score is defined.

### 4.5 Transparency outputs
The model returns not just a number but a **breakdown**: capped vs uncapped
deduction, counts per severity, points per severity, and per-source attribution
(pentest / audit / self-assessment / vendor). Every point of deduction is
explainable.

---

## 5. Framework-agnostic mapping engine

- A finding maps to one or more **controls**.
- A control maps to one or more **framework requirements**.
- Therefore a single finding simultaneously affects **ISO 27001, SOC 2, GDPR,
  NIST CSF, and PCI-DSS** — and per-framework compliance scores are derived from
  the same control/risk data.
- **Adding a regulator** (e.g., a regional framework such as NCA ECC or SAMA
  CSF-style requirement sets) means adding a **control-mapping table** — the
  scoring model does not change. The engine is regulator-agnostic by design.

This solves the core problem the project set out to solve: **compliance mapping
and scoring for any requirement or regulator**, from one set of evidence.

---

## 6. Validation & reproducibility

- The platform ships an **automated integration test suite** (Node test runner)
  that includes a **score-movement regression test**: it opens a critical
  finding, re-syncs, asserts the score **drops**, then closes it and asserts the
  score **recovers**, and verifies synced findings use the canonical 0–100
  scale.
- **Reproducible live result** (two demo orgs, synthetic data): overall score
  **52 → 47** on opening a critical finding, **47 → 52** on remediation —
  deterministic and reversible.

---

## 7. Architecture (self-hosting for regulated orgs)

- **Single codebase**, two runtime targets:
  - **On-prem:** Node.js + **PostgreSQL** + Docker (air-gap friendly; data stays
    inside the organization).
  - **Edge:** Cloudflare (Pages/Workers + D1) for low-friction hosting.
- A runtime SQL adapter lets the same source run against both backends.
- Cross-system sync is authenticated with a shared key; org identity is matched
  on a stable `organization_id` so multiple organizations coexist cleanly.

---

## 8. Maturity & honest limitations

- **MVP/POC.** The scoring model, scale-normalization, and multi-framework
  mapping are implemented and tested; this is not a finished commercial product.
- Framework content ships for **five** frameworks; the engine is designed to
  extend to any regulator via mapping tables.
- Roadmap: richer evidence linkage, continuous-control-monitoring feeds, and
  additional regional regulator packs.

---

## 9. Conclusion
Compliance scoring should be a **live, explainable, framework-agnostic** signal
derived from real risk — not a static checklist percentage. We contribute a
concrete scoring model, a widely-applicable integration-bug fix, and a mapping
engine that turns one set of findings into a defensible score for any regulator,
demonstrated on a working open platform.
