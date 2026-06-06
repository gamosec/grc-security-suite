# AutoAudit - GRC Intelligence Platform

## Overview
AutoAudit is a React web application that generates cybersecurity GRC (Governance, Risk & Compliance) artifacts using Cloudflare Workers AI. It provides policy generation, an AI GRC consultant chat, and ISO 27001 gap analysis.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Cloudflare Pages Functions (JavaScript Workers)
- **AI**: Cloudflare Workers AI (`env.AI.run(...)`)
- **Database**: Cloudflare D1 (SQLite) for session persistence

## Project Structure
```
/
├── src/
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Main app with routing/navigation
│   ├── i18n.js           # Internationalization (Arabic support)
│   └── modules/
│       ├── PolicyModule.jsx      # Policy Generator
│       ├── ConsultantModule.jsx  # AI GRC Consultant chat
│       └── GapModule.jsx         # Gap Analysis module
├── functions/api/
│   ├── chat.js           # AI chat endpoint (Cloudflare)
│   ├── session.js        # Session CRUD with D1
│   ├── policy-session.js
│   └── consultant-session.js
├── vite.config.js        # Vite config (port 5000, host 0.0.0.0)
├── index.html
└── package.json
```

## Development
- **Start**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build` (outputs to `dist/`)
- **Package manager**: npm

## Deployment
- Configured as a **static** deployment
- Build command: `npm run build`
- Public directory: `dist`

## Notes
- The `/api/*` routes are Cloudflare Pages Functions — they require Cloudflare deployment with AI and D1 bindings to work
- In local dev, API calls (chat, sessions) will return 404 since there's no local Cloudflare emulation
- See `DEPLOY.md` for Cloudflare deployment instructions
