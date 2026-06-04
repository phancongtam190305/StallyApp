# Stally Main Deploy Runbook

## Architecture

- Backend must run on a long-running Node service such as Render/Railway because IMAP polling must stay alive.
- Vercel should serve only the Vite frontend.
- Frontend calls backend through `VITE_API_BASE_URL`.

## Backend

Render/Railway settings:

```bash
npm ci --include=dev && npm run build
npm start
```

Health check:

```text
/api/health
```

Required env values are listed in `.env.production.example`.

Important production defaults:

```env
AUTO_PERSIST_ENABLED=true
RELOAD_DB_ON_EVERY_REQUEST=false
SUPPLIER_DISCOVERY_ALLOW_SIMULATOR=false
EMAIL_PROVIDER=gmail_api
EMAIL_ALLOW_SIMULATOR=false
EMAIL_RECIPIENT_OVERRIDE=
VITE_ENABLE_DEV_TOOLS=false
```

Use `EMAIL_RECIPIENT_OVERRIDE` only for safe email testing. Leave it empty when sending RFQ to real suppliers.

For production email sending, prefer Gmail API because SMTP port `465/587` can time out on cloud hosts:

```env
EMAIL_PROVIDER=gmail_api
GMAIL_API_CLIENT_ID=...
GMAIL_API_CLIENT_SECRET=...
GMAIL_API_REFRESH_TOKEN=...
GMAIL_API_SENDER_EMAIL=your_gmail@gmail.com
```

The refresh token must be authorized with:

```text
https://www.googleapis.com/auth/gmail.send
```

## Frontend

Vercel settings:

```bash
npm run build:frontend
```

Output directory:

```text
dist
```

Set this in Vercel env:

```env
VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com
VITE_ENABLE_DEV_TOOLS=false
VITE_EMAIL_ROLE_AUTH_ENABLED=true
```

## Google OAuth

Authorized JavaScript origins:

```text
https://YOUR-FRONTEND.vercel.app
https://YOUR-BACKEND.onrender.com
```

Authorized redirect URIs:

```text
https://YOUR-BACKEND.onrender.com/api/v1/auth/google/callback
```

Set backend env:

```env
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND.onrender.com/api/v1/auth/google/callback
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
```

## Smoke Test

1. `GET /api/health` returns `ok: true`.
2. `GET /api/email/status` shows SMTP and IMAP configured.
3. Google login works.
4. Crawl supplier returns real AI/search results.
5. RFQ draft can be edited.
6. RFQ sends to the intended recipient when `EMAIL_RECIPIENT_OVERRIDE` is empty.
7. Gmail reply is picked up by IMAP polling and quote appears in comparison.
