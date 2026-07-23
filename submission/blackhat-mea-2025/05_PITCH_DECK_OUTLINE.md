# 05 — Pitch Deck Outline (slide-by-slide)

> Build in Keynote/PowerPoint/Google Slides. Dark theme (Black Hat aesthetic),
> one idea per slide, big type, minimal text. ~16 slides for 40 min.

---

**Slide 1 — Title**
- *The Compliance Score Is Lying*
- Subtitle: Building a live, framework-agnostic GRC score that moves when your findings do
- Presenter name(s), org, Black Hat MEA 2025
- Visual: a big compliance gauge

**Slide 2 — The hook (put dashboards on trial)**
- "What's your compliance score? Now prove it."
- Three questions no static score answers: *Why? What changes it today? Which evidence?*

**Slide 3 — The problem**
- Point-in-time snapshots · checklist scores · no traceability · framework silos · disconnected tools
- One line: "95% compliant — with a critical vuln wide open."

**Slide 4 — The multi-regulator reality**
- One finding → ISO 27001 + SOC 2 + GDPR + NIST CSF + PCI-DSS (+ regional regulators)
- Visual: one finding fanning out to 5+ frameworks

**Slide 5 — What "good" looks like**
- Living · Explainable · Bounded · Framework-agnostic

**Slide 6 — The integration bug nobody talks about**
- Title: "Your critical findings are being filed as 'low'."
- 1–25 scale (pentest) vs 0–100 buckets (GRC)

**Slide 7 — The silent failure (diagram)**
- critical (25 on 1–25) → read as 25 on 0–100 → "low" → ~0 penalty → score never moves
- Red "SILENT" stamp

**Slide 8 — The fix: normalize at the boundary**
- critical 95 / high 75 / medium 50 / low 25 / info 10
- Carry categorical severity + canonical numeric; make it testable

**Slide 9 — The scoring model (the core)**
- Base = implemented/applicable × 100
- Deduction = Σ severity weights (5/3/1/0.5), in-progress ½, cap 40
- Final = max(0, round(Base − Deduction))

**Slide 10 — Why each choice**
- Base = governance · Deduction = reality · ½ = reward remediation-in-motion · cap = preserve signal

**Slide 11 — One shared function**
- Same score on dashboard, compliance page, exec summary → auditable, single definition

**Slide 12 — LIVE DEMO (full-bleed)**
- Just the word **DEMO** + the two app logos; switch to live screens
- (Fallback video ready)

**Slide 13 — Demo result (leave up after demo)**
- Table: 52 → 47 (open critical) → 52 (remediate)
- "Deterministic. Reversible. Live."

**Slide 14 — Framework-agnostic mapping engine**
- finding → controls → requirements → many frameworks
- "Add a regulator = add a mapping table. Scoring never changes."

**Slide 15 — Architecture**
- Single codebase → on-prem (PostgreSQL/Docker, air-gap) + edge (Cloudflare)
- "Regulated orgs can self-host."

**Slide 16 — Takeaways + CTA**
- 5 takeaways (from abstract)
- "Open MVP/POC — come build regulator mappings with us." Repo/contact.

---

## Design notes
- Palette: near-black background, white text, one accent (Black Hat red/green).
- Use **numbers big** (52 → 47 → 52) — that's the money shot.
- No paragraphs. Speaker notes carry the detail.
- Add slide numbers + a subtle progress dot for the demo section.
- Export a **PDF backup** of the deck (in case of AV issues).
