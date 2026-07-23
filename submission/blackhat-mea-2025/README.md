# Black Hat MEA 2025 — Submission Package
## GRC Security Suite — Live GRC Track for Security Teams

> **Event:** Black Hat MEA 2025 · Riyadh Exhibition & Conference Center, Malham · **2–4 December 2025**
> **Briefings CFP deadline:** **Monday 31 August 2025, 11:00pm KSA** (notification 14 September)
> **Format:** 20 or 40-minute Briefing · up to 2 presenters · reviewed for **originality, technical depth, accuracy**
> **Submission portal:** https://blackhatmea.com/briefings

---

## 0. TL;DR — what we are submitting

A **Briefing + live tool demonstration** of the **GRC Security Suite**: an open,
integrated Governance-Risk-Compliance platform (MVP/POC) where an entire
security team works across **two connected systems** — **Pentest Pulse**
(pentest & findings management) and **GRC Pulse** (risk & compliance) — and
watches a **live, risk-adjusted compliance score** move in real time as
findings are opened, remediated, and re-synced.

**The problem we solve:** *compliance mapping and scoring* — turning raw
pentest/audit findings into a defensible, always-current compliance score for
**any regulation or framework** (ISO 27001, SOC 2, GDPR, NIST CSF, PCI-DSS),
instead of point-in-time spreadsheets that are stale the moment they're signed.

---

## 1. Which track(s) to submit to

| Track | Fit | Recommendation |
|-------|-----|----------------|
| **Briefings (Call for Papers)** | Talk on the compliance-mapping/scoring problem + methodology + live demo | ✅ **PRIMARY — submit here** (deadline 31 Aug) |
| **Arsenal / Call for Tools** | Open-source live tool demo at a station | ✅ **SECONDARY — submit if open** (great for an MVP platform) |
| Executive Summit | CISO-level strategy | Optional, if you want the leadership angle |

> Strategy: lead with a **Briefing** (the intellectual contribution — the
> scoring model and mapping engine) and back it with a **live tool demo** so
> reviewers see a *real, working* platform, not slideware. If a separate
> Arsenal/Call-for-Tools form is open, submit the same tool there too.

---

## 2. Files in this package

| File | Purpose | Where it goes |
|------|---------|---------------|
| `01_SUBMISSION_FORM.md` | Copy-paste answers for every field of the portal | The online form |
| `02_BRIEFING_ABSTRACT.md` | The talk: title, abstract, outline, takeaways | "Abstract" / "Outline" fields |
| `03_WHITEPAPER_problem_and_method.md` | The deep technical/whitepaper backing | Attach as supporting PDF |
| `04_LIVE_DEMO_SCRIPT.md` | Minute-by-minute live demo runbook | Your rehearsal + demo |
| `05_PITCH_DECK_OUTLINE.md` | Slide-by-slide deck you build in Keynote/PPT | Presentation |
| `06_SPEAKER_BIO.md` | Bios + headshot notes | "Speaker" fields |
| `README.md` | This file — strategy + checklist | You |

---

## 3. Positioning — how to win the review

Black Hat reviewers reward **originality, technical depth, accuracy**. Our angles:

1. **Original thesis:** "Compliance scores lie." Most GRC tools show a *static*
   percentage from a checklist. We show a **living score** that is
   *mathematically derived* from real, current risk posture and **moves the
   instant a finding changes** — provable on stage.
2. **Technical depth:** the **Weighted Deduction scoring model**, the
   **severity-scale normalization bug** most integrations get wrong (1–25 vs
   0–100), and a **framework-agnostic control-mapping engine** that lets one
   finding affect ISO 27001, SOC 2, GDPR, NIST, PCI at once.
3. **Accuracy / credibility:** it's a **real running platform** (not a mockup)
   with a test suite, two connected apps, PostgreSQL on-prem + Cloudflare edge
   deployment, and a reproducible live demo.
4. **Regional relevance:** built for teams operating under multiple regulators
   (incl. Saudi **NCA ECC / SAMA CSF**-style multi-framework obligations — we
   position the mapping engine as regulator-agnostic).

---

## 4. The one-sentence hook (memorize this)

> "Every GRC dashboard in this room shows a compliance score — but almost none
> of them can tell you *why* it's that number, or watch it change when your red
> team closes a finding. We built one that can, and we'll prove it live."

---

## 5. Submission checklist

- [ ] Create speaker account on https://blackhatmea.com/briefings
- [ ] Choose track: **Briefings** (primary)
- [ ] Paste **title** (from `01_SUBMISSION_FORM.md`)
- [ ] Paste **abstract** (≤ the portal's word limit — short + long versions provided)
- [ ] Paste **detailed outline** / **takeaways**
- [ ] Select **length**: 40 minutes (demo needs the time) — fallback 20 min version provided
- [ ] Add **presenter bio(s)** + headshot (300 dpi)
- [ ] Attach **whitepaper PDF** (`03_...`) as supporting material
- [ ] Confirm **not a product pitch** — frame as research + methodology + open tool
- [ ] Note **no vendor/marketing** submissions (must be by the speaker)
- [ ] Submit **before 31 Aug 11:00pm KSA** — aim for **early submission** (they favor early)
- [ ] (If open) also submit to **Arsenal / Call for Tools**

---

## 6. Honesty guardrails (keep the submission credible)

- It's an **MVP/POC** — say so. Reviewers respect honest maturity framing.
- Don't overclaim certifications or customer counts we don't have.
- Everything demoed must be **reproducible** on the day (the demo script pins
  exact steps + expected numbers: score 52 → 47 → 52).
- Multi-framework mapping is **implemented for the 5 frameworks shipped**; the
  *engine* is regulator-agnostic — phrase it that way.
