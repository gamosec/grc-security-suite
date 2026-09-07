# Security Policy

## 🔐 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## 🚨 Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it privately through **GitHub Security Advisories / private vulnerability reporting** for this repository.

### Do NOT:
- ❌ Open a public GitHub issue for an unpatched vulnerability
- ❌ Post about it on social media
- ❌ Share exploit details publicly before remediation

### Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge valid reports and work to investigate and remediate them as quickly as practical.

## 🛡️ Security Expectations

When deploying GRC Security Suite:

### Secrets & configuration
- Store JWT secrets, API keys, sync keys, and other sensitive configuration in Cloudflare secrets/environment bindings.
- Never commit database exports, backups, production credentials, or internal restore artifacts.
- Rotate any credential that may have been exposed.

### Authentication & authorization
- Use strong password hashing suitable for password storage (for example, Argon2id or PBKDF2), not a plain SHA-256 digest.
- Enforce authentication and organization/tenant authorization on every protected API endpoint.
- Use secure, appropriately scoped cookies for sessions.

### API security
- Restrict CORS to trusted application origins.
- Validate and authorize resource identifiers server-side.
- Apply rate limiting and input validation to externally reachable endpoints.

### Deployment
- Keep dependencies updated and review `npm audit` findings.
- Enable appropriate Cloudflare security controls.
- Maintain backups outside the public source repository.
- Monitor access and security logs for suspicious activity.

## 🏆 Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve the project.
