# AutoAudit — Cloudflare Deployment Guide
## 100% Free — Cloudflare Workers AI (Llama 3.1) + Pages

---

## Architecture

```
Browser  ──POST /api/chat──▶  Cloudflare Pages Function
                               └── env.AI.run(Llama 3.1)  ← FREE
```

- **No Anthropic key needed** — uses Cloudflare's free Workers AI
- **No credit card** — Workers AI free tier: 10,000 neurons/day (~200 audits)
- **Shareable URL** — anyone can open it, no login

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "AutoAudit initial deploy"
git branch -M main

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/autoaudit.git
git push -u origin main
```

---

## Step 2 — Deploy to Cloudflare Pages

1. Go to **https://dash.cloudflare.com** (free account)
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Select your `autoaudit` repo
4. Build settings:

| Setting | Value |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |
| Node version | `20` |

5. Click **Save and Deploy**

---

## Step 3 — Enable the AI Binding ⚠️ CRITICAL

The Pages Function needs an `AI` binding to access Workers AI for free.

1. Pages project → **Settings** → **Functions**
2. Scroll to **AI Bindings** → **Add binding**
   - Variable name: `AI`
3. **Save** → go to **Deployments** → **Retry deploy**

That's it. **No API keys, no secrets, no billing.**

---

## Step 4 — Share the URL

```
https://autoaudit-XXXX.pages.dev
```

Share with your supervisor — anyone can open it instantly.

---

## Free Tier Limits

| Resource | Free Allowance |
|---|---|
| Pages hosting | Unlimited |
| Pages Functions | 100,000 req/day |
| Workers AI (Llama 3.1 8B) | 10,000 neurons/day (~200 audits) |
| **Total cost** | **$0** |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "AI is not defined" error | Add the `AI` binding in Pages → Settings → Functions → redeploy |
| Build fails | Set Node version to `20` in build settings |
| Empty/bad JSON response | Llama occasionally misfires — just retry the audit |
| White screen | Open browser console, usually a React import error |
