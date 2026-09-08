# GRC Pulse

> Open-source Governance, Risk and Compliance platform for modern security teams.

GRC Pulse is the GRC component of the **GRC Security Suite**, connecting risk management, compliance, controls, assets, vendors, maturity assessment, and penetration-testing findings.

## Highlights

- Risk register with business-context scoring
- ISO 27001:2022 compliance and gap assessment
- Cross-framework mappings
- Control and evidence management
- Asset and vendor risk management
- Security maturity assessment
- AI-assisted security workflows
- Integration with Pentest Pulse
- Cloudflare Pages + D1 deployment model

## Live Demo

https://grc-pulse.pages.dev

**Security note:** This public repository intentionally contains **no default production credentials**. Create disposable local credentials for your own testing environment.

## Local Development

```bash
cd grc-pulse
npm install

for f in migrations/*.sql; do
  npx wrangler d1 execute grc-pulse-db --local --file="$f"
done

npx wrangler d1 execute grc-pulse-db --local --file=seed.sql
npm run build
npm run dev
```

The public seed data is synthetic and intended for demonstration only. Do not commit production database exports or real organization/customer data.

## Configuration

Sensitive values such as JWT signing secrets must be provided through environment variables or Cloudflare secrets. They must never be hard-coded in source control.

## Security

Please see the repository-level `SECURITY.md` for responsible disclosure instructions and deployment security guidance.

## Architecture

GRC Pulse is designed to integrate with the other components of GRC Security Suite:

```text
AutoAudit  →  Compliance / Policy Analysis
                    ↓
GRC Pulse  ↔  Risk / Controls / Compliance
                    ↕
Pentest Pulse → Findings / Projects / Evidence
```

The key value of the suite is the flow from **security finding → risk → control/compliance mapping → remediation → audit readiness**.

## License

See the repository `LICENSE` file.
