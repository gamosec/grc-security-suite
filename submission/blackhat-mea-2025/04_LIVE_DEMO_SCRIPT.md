# 04 — Live Demo Runbook

> The demo is the star of the talk. It must be **reproducible** and **fail-safe**.
> This runbook pins exact steps, expected numbers, and a recorded fallback.

---

## A. Demo thesis (say this while it loads)
"Two systems, one security team. The red team logs findings in Pentest Pulse;
the compliance team watches the score in GRC Pulse. Watch the compliance score
move when a finding changes — no spreadsheet, no re-audit."

---

## B. Pre-flight (do this before you walk on stage)

1. Start the stack (PostgreSQL + all three apps):
   - PostgreSQL on `:5432` (db `grc_suite`; schemas `grc_pulse`, `pentest_pulse`, `autoaudit`)
   - GRC Pulse on `:3002`
   - Pentest Pulse on `:3003` (set a writable `EVIDENCE_DIR`)
2. Confirm health:
   ```bash
   curl -s -o /dev/null -w "GRC:%{http_code} " http://localhost:3002/
   curl -s -o /dev/null -w "PT:%{http_code}\n"  http://localhost:3003/
   # expect GRC:200 PT:302
   ```
3. Log in to both (org-001 Acme):
   - GRC Pulse: `admin@acme.com` / `GrcDemo!2026`
   - Pentest Pulse: `admin@pentestpulse.io` / `admin123`
4. **Reset to baseline** — ensure the demo critical finding is *remediated*, then
   run one sync so GRC shows the baseline score **52**.
5. Open two browser windows side-by-side: Pentest Pulse (left) + GRC Pulse
   dashboard (right). Zoom the browser to 125–150% for the room.
6. Have the recorded fallback video open in a third tab (see §E).

---

## C. The demo — 8 minutes, 3 beats

### Beat 1 — Baseline (1.5 min)
- On **GRC Pulse dashboard**, point to `complianceHealth`:
  - **overallScore = 52**, baseScore = 78, riskPenalty = 26.5
  - Show the penalty breakdown: critical 12.5, high 12, medium 2.
- Message: "This 52 is *derived*. 78 from control coverage, minus 26.5 from live
  open risk. Every point is explainable."

### Beat 2 — Open a critical finding, score DROPS (3 min)
- Switch to **Pentest Pulse**. Open the critical finding *"SQL Injection in
  Search Function"* → change status **remediated → open**.
- Trigger sync (Pentest → GRC). (Button in GRC, or the sync endpoint.)
- Switch to **GRC Pulse**, refresh dashboard:
  - **overallScore = 52 → 47** ⬇
  - riskPenalty 26.5 → 31.5; criticalPenalty 12.5 → 17.5 (exactly **−5** for one critical).
- Message: "One critical finding just cost exactly 5 points. This is the
  Weighted Deduction model on stage. No re-audit — it's *live*."

### Beat 3 — Remediate, score RECOVERS (2.5 min)
- Back in **Pentest Pulse**: set the same finding **open → remediated**.
- Sync again.
- **GRC Pulse** dashboard:
  - **overallScore = 47 → 52** ⬆ (fully recovered — deterministic & reversible).
- Then show **framework view**: the same finding reflected across ISO 27001 /
  SOC 2 / GDPR / NIST CSF / PCI-DSS scores at once (the mapping engine).
- Message: "Fix it, the score comes back — and it moved every framework at once,
  because we mapped the finding once."

---

## D. Expected numbers (memorize — verified)

| Moment | overallScore | riskPenalty | criticalPenalty |
|--------|-------------|-------------|-----------------|
| Baseline (finding closed) | **52** | 26.5 | 12.5 |
| Critical finding OPENED | **47** | 31.5 | 17.5 |
| Critical finding REMEDIATED | **52** | 26.5 | 12.5 |

If the numbers differ, you did not reset to baseline — re-run pre-flight step 4.

---

## E. Fail-safe (never demo live without this)
- Record a **90-second screen capture** of Beats 1–3 with the exact numbers
  above, narrated, before the conference.
- If anything is slow/broken on stage, cut to the video with one sentence:
  *"Live network's fighting me — here's the same run I recorded this morning."*
  Reviewers and audiences forgive this; a frozen screen kills the talk.

---

## F. What to have on screen at all times
- Score number **large** (zoom the dashboard tile).
- The **penalty breakdown** panel visible so the audience sees *why* it moved.
- The two apps clearly labeled so it's obvious this is a **team** workflow.

---

## G. Data hygiene / ethics note (say once)
"All data here is synthetic — two fictional orgs, Acme and Almadar. No real
vulnerabilities or customers are shown."

---

## H. Post-demo restore
- Set the demo finding back to its original seed status and run a final sync so
  the environment is clean for any booth/Arsenal follow-up.
