# Stally Deploy Runbook

Muc tieu: deploy MVP cho user dung thu voi Supabase Postgres, Render backend long-running, Gmail SMTP/IMAP, Google OAuth va optional Vercel frontend.

## 1. Kien Truc Deploy Khuyen Nghi

Mac dinh nen deploy **full-stack tren Render**:

- Render chay Express backend.
- Backend build Vite frontend vao `dist/`.
- Express serve frontend production tu `dist/`.
- IMAP polling chay nen on dinh trong process Render.

Neu van muon tach frontend:

- Render: backend + IMAP polling.
- Vercel: frontend static.
- `vercel.json` proxy `/api/*` ve Render backend.

## 2. Local Preflight

Chay truoc khi push:

```bash
npm run lint
npm run build
```

Test nhanh:

```bash
npm run dev
curl http://localhost:3000/api/health
curl http://localhost:3000/api/email/status
curl http://localhost:3000/api/v1/auth/config
```

## 3. Render Setup

Dung Blueprint:

1. Push repo len GitHub.
2. Render -> New -> Blueprint.
3. Chon repo.
4. Render doc `render.yaml`.

Hoac tao Web Service thu cong:

- Environment: `Node`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

## 4. Render Environment Variables

Nhap trong Render dashboard. Khong commit secret vao Git.

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=5
AUTO_PERSIST_ENABLED=true
RELOAD_DB_ON_EVERY_REQUEST=false

APP_URL=https://YOUR-RENDER-SERVICE.onrender.com
FRONTEND_URL=https://YOUR-RENDER-SERVICE.onrender.com

GEMINI_API_KEY=...

GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-RENDER-SERVICE.onrender.com/api/v1/auth/google/callback
GOOGLE_OAUTH_AUTO_PROVISION=true
GOOGLE_OAUTH_ALLOWED_DOMAINS=gmail.com
GOOGLE_OAUTH_DEFAULT_ROLE=requester

EMAIL_ROLE_AUTH_ENABLED=true
VITE_EMAIL_ROLE_AUTH_ENABLED=true
VITE_ENABLE_DEV_TOOLS=false

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=true
SMTP_FROM_NAME=Stally B2B Sourcing
SMTP_FROM_EMAIL=...

IMAP_POLL_ENABLED=true
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=...
IMAP_PASS=...
IMAP_SECURE=true
IMAP_MAILBOX=INBOX
IMAP_POLL_INTERVAL_MS=60000
```

Neu deploy frontend rieng tren Vercel, doi:

```env
FRONTEND_URL=https://YOUR-VERCEL-FRONTEND.vercel.app
```

## 5. Google OAuth Console

OAuth Client phai la **Web application**.

Authorized JavaScript origins:

```text
http://localhost:3000
https://YOUR-RENDER-SERVICE.onrender.com
https://YOUR-VERCEL-FRONTEND.vercel.app
```

Authorized redirect URIs:

```text
http://localhost:3000/api/v1/auth/google/callback
https://YOUR-RENDER-SERVICE.onrender.com/api/v1/auth/google/callback
```

Neu chi deploy full-stack tren Render, Vercel origin co the bo qua.

## 6. Vercel Setup Neu Tach Frontend

`vercel.json` hien dang proxy API ve:

```text
https://stally-backend.onrender.com
```

Neu URL Render cua ban khac, sua `destination` trong `vercel.json`.

Vercel Project Settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## 7. Gmail SMTP/IMAP

Can lam trong Gmail:

1. Bat 2-Step Verification.
2. Tao App Password.
3. Bat IMAP trong Gmail settings.
4. Dung App Password cho `SMTP_PASS` va `IMAP_PASS`.

Khong dung password Gmail thuong.

## 8. Smoke Test Sau Deploy

Mo:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
https://YOUR-RENDER-SERVICE.onrender.com/api/email/status
https://YOUR-RENDER-SERVICE.onrender.com/api/v1/auth/config
```

Kiem tra flow:

1. Login Google.
2. User moi duoc tao trong Supabase table `users`.
3. Tao case mua hang.
4. Crawl NCC.
5. Chon candidate va promote vao danh sach chinh.
6. Soan RFQ.
7. Gui RFQ toi email test.
8. Reply email bao gia tu mailbox khac.
9. Cho IMAP polling doc reply.
10. Kiem tra quote/comparison dashboard.
11. Approve/negotiation/PO/receive hang.

## 9. Luu Y Pilot

- Render free co the sleep, IMAP polling se khong on dinh. Nen dung Starter.
- `AUTO_PERSIST_ENABLED=true` van la MVP mode, cac request ghi con full-sync state. Du pilot it user duoc, nhung can migrate targeted SQL cho production lon.
- `RELOAD_DB_ON_EVERY_REQUEST=false` bat buoc de tranh login/UI bi cham.
- `VITE_ENABLE_DEV_TOOLS=false` de an mock/simulated controls khoi user that.
