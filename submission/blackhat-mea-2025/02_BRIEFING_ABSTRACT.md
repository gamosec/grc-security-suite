# 02 — Briefing Abstract & Detailed Outline

**Working title:** *The Compliance Score Is Lying: Building a Live,
Framework-Agnostic GRC Score That Moves When Your Findings Do*

**Length:** 40 minutes (35 content + 5 Q&A) · Fallback 20-minute cut noted inline
**Presenters:** 1–2 · **Level:** Intermediate · **Track:** GRC / SecOps

---

## The narrative arc (why this talk lands)

> Setup → Problem → Why existing tools fail → Our method → **Live proof** →
> Generalization → Takeaways.

We open by putting the audience's own dashboards on trial, expose a bug pattern
they almost certainly ship, teach a scoring model they can reuse, and then
**prove it on stage** with a real platform. We end by generalizing to *any*
regulator so everyone in the room can apply it.

---

## Detailed outline (40-min)

### 0:00–0:04 — Cold open: "What's your compliance score? Now prove it."
- Poll the room: who has a GRC dashboard with a % score?
- The three questions no static score can answer:
  1. *Why* is it that number?
  2. What happens to it when the red team closes a finding *today*?
  3. Which specific evidence produced it?
- Thesis: **most compliance scores are point-in-time checklist snapshots — stale,
  unexplainable, and disconnected from live risk.**
- *(20-min cut: 2 minutes, skip the poll.)*

### 0:04–0:10 — The problem: compliance mapping & scoring done wrong
- The real-world workflow gap: pentest team finds things → audit team tracks
  controls → nobody reconciles them into a *current* number.
- Spreadsheets & annual audits: why they rot immediately.
- The multi-regulator reality (ISO 27001, SOC 2, GDPR, NIST CSF, PCI-DSS, plus
  regional regulators): the **same finding** touches many frameworks, but tools
  make you re-enter it per framework.
- What "good" looks like: a **living, explainable, framework-agnostic** score.

### 0:10–0:18 — Why integrations silently break: the scale-mismatch bug
- The most common real bug when you connect a pentest tool to a GRC tool:
  **severity scale mismatch**.
  - Pentest side: risk = likelihood × impact on a **1–25** scale (critical = 5×5 = 25).
  - GRC side: severity buckets on a **0–100** scale (≥75 critical, ≥50 high,
    ≥25 medium, <25 low).
  - Result: a **critical** finding arrives as ~25 → GRC files it as **low** →
    ~0 penalty → **closing it never moves the score.** The dashboard looks fine
    and is quietly wrong.
- How to detect it (symptoms: score never changes; everything is "low").
- The fix: **normalize at the boundary** — map severity → canonical 0–100
  (critical 95 / high 75 / medium 50 / low 25) and carry an explicit
  `severity` alongside the numeric score.
- *This section alone is worth the ticket for tool builders.*

### 0:18–0:26 — The Weighted Deduction scoring model
- Design goals: **explainable, monotonic, bounded, framework-agnostic.**
- The model:
  ```
  Base       = implemented / applicable controls × 100
  Deduction  = Σ open/in-progress risks by severity
               (Critical −5, High −3, Medium −1, Low −0.5),
               in-progress at HALF weight, capped at 40
  Final      = max(0, round(Base − Deduction))
  ```
- Why each choice:
  - Base from control coverage = the "governance" half.
  - Deduction from live risk = the "reality" half.
  - Half weight for in-progress = rewards remediation *in motion*.
  - The cap = one bad month can't zero you out and destroy signal.
- **One shared function** feeds every view (dashboard, compliance page,
  executive summary) → the number is identical everywhere and auditable.
- Contrast with naive models (flat −1 per finding; or pure checklist).

### 0:26–0:34 — LIVE DEMO: watch the score move
- Two connected systems on screen: **Pentest Pulse** + **GRC Pulse**, two orgs
  (Acme, Almadar), a full security team's-eye view.
- Show baseline: overall score **52** (base 78, risk penalty 26.5).
- **Open a critical finding** in Pentest → sync → GRC score drops **52 → 47**
  (critical = −5). Show the penalty breakdown update live.
- **Remediate the finding** → sync → score recovers **47 → 52**. Deterministic.
- Show the **same finding** reflected across ISO 27001 / SOC 2 / GDPR / NIST /
  PCI framework scores simultaneously (the mapping engine).
- *(20-min cut: this is the section you keep — 8 minutes, drop the model
  derivation to 3.)*
- **Backup:** if live fails, a pre-recorded 90-second capture with the exact
  same numbers (see `04_LIVE_DEMO_SCRIPT.md`).

### 0:34–0:38 — Generalize to any regulator
- The mapping engine: a finding maps to **controls**, controls map to
  **framework requirements** — add a regulator by adding a control-mapping
  table, no scoring change.
- Regional angle: multi-framework obligations (e.g., an org answering to several
  regulators at once) get **one** score model and **many** framework views.
- Architecture note: **single codebase**, two runtime targets — on-prem
  (PostgreSQL/Docker, air-gap friendly) and edge (Cloudflare) — so regulated
  orgs can self-host.

### 0:38–0:40 — Takeaways & call to action
- Stop trusting static percentages; demand explainability.
- Adopt a risk-weighted, bounded, shared-function score.
- Normalize severity at every integration boundary.
- The platform is an open MVP/POC — come build regulator mappings with us.

---

## Five things the audience leaves with
1. A mental model for a **defensible** compliance score.
2. The **scale-mismatch** failure mode + fix (immediately actionable).
3. A reusable **Weighted Deduction** formula.
4. A **framework-agnostic mapping** pattern.
5. A working **open platform** to try.

## Q&A seeds (prepare answers)
- "How is this different from [big GRC vendor]?" → live + explainable + open + self-hostable.
- "How do you prevent gaming the score?" → cap, in-progress half weight, evidence-linked.
- "Does it support [regulator X]?" → engine is mapping-driven; adding X = adding a mapping table.
- "Maturity?" → honest: MVP/POC, tested, two connected apps, reproducible demo.
