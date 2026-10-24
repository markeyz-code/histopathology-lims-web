# Production deployment — Vercel + Railway

## How many frontends?

There is **one frontend application**: `frontends/web` (Nuxt 3 / Vue 3). It contains all user surfaces behind one deployment:

- public marketing and demo site (`/landing`)
- staff workspace (`/login`, `/dashboard`, `/cases`, `/results`, `/microbiology`, `/quality`)
- laboratory administration (`/admin/*`)
- super-administration (`/super-admin`)
- clinician/referrer portal (`/portal/*`)
- public report verification (`/verify`)
- offline PWA

Deploy this as **one Vercel project**. Do not split it into separate frontend repositories for deployment; the route groups share authentication, API client, layout and PWA runtime.

Backend: one NestJS API (`backend/api`) on Railway. MongoDB and Redis are managed services.

## Repository layout for deployment

```
histopathology-lims (GitHub)
├─ frontends/web     -> Vercel (or alias frontend/)
├─ backend/api       -> Railway (Dockerfile)
├─ backend/connector -> Serial/TCP analyzer agent
├─ packages/shared   -> built during both deployments
├─ vercel.json
├─ railway.json
└─ docs/deployment.md
```

Vercel project root: **repository root** (recommended, root `vercel.json` builds shared package and web app together) or set root directory to `frontends/web`.

## Frontend — Vercel

1. Vercel → **Add New Project** → import the `histopathology-lims` GitHub repository.
2. Set **Root Directory** to the repository root (or `frontends/web`).
3. Framework preset: **Other** (the repository supplies `vercel.json`).
4. Build command/output are already defined:
   - `pnpm --filter @lims/shared build && pnpm --filter @lims/web generate`
   - output: `frontends/web/.output/public`
5. Add Production environment variables:

| Variable                    | Example                                          |
| --------------------------- | ------------------------------------------------ |
| `NUXT_PUBLIC_API_BASE`      | `https://lims-api-production.up.railway.app/api` |
| `NUXT_PUBLIC_WEB_BASE`      | `https://lims.vercel.app`                        |
| `NUXT_PUBLIC_APP_NAME`      | `Laboratory LIMS`                                |
| `NUXT_PUBLIC_COOKIE_SECURE` | `true`                                           |

6. Deploy. The output is a static SPA. `vercel.json` rewrites extensionless routes to `200.html`, so deep links such as `/cases/123`, `/portal/login` and `/admin/settings` work on refresh.
7. Add the production domain, then update Railway's `CORS_ORIGINS`, `PUBLIC_WEB_URL`, and Vercel's `NUXT_PUBLIC_WEB_BASE`, and redeploy both.

Public runtime variables are **baked in at build time**. Changing `NUXT_PUBLIC_API_BASE` requires a new Vercel deployment.

## Backend — Railway

1. Create a Railway project from the same GitHub repository. Railway reads `railway.json` and builds `backend/api/Dockerfile`.
2. Add a **Redis** service and expose `REDIS_URL` to the API service.
3. Use **MongoDB Atlas** (recommended) or a MongoDB replica set. The API uses transactions for accessioning, custody and onboarding; a standalone MongoDB will fail those operations. Set `MONGODB_URI` to the replica-set connection string.
4. Add a **persistent volume** mounted at `/data` and set `STORAGE_DIR=/data/storage`. The container entrypoint repairs ownership and drops to the non-root `node` user. Without a volume, generated PDFs disappear on redeploy.
5. Add API environment variables from [`backend/api/.env.production.example`](../backend/api/.env.production.example). Minimum required:

| Variable                                   | Value                                 |
| ------------------------------------------ | ------------------------------------- |
| `NODE_ENV`                                 | `production`                          |
| `MONGODB_URI`                              | Atlas replica-set URI                 |
| `REDIS_URL`                                | Railway Redis URL                     |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 48`             |
| `CORS_ORIGINS`                             | `https://YOUR-FRONTEND.vercel.app`    |
| `PUBLIC_WEB_URL`                           | `https://YOUR-FRONTEND.vercel.app`    |
| `PUBLIC_API_URL`                           | `https://YOUR-API.up.railway.app/api` |
| `STORAGE_DIR`                              | `/data/storage`                       |
| `SWAGGER_ENABLED`                          | `false`                               |
| `PORTAL_DEBUG`                             | `false`                               |
| `QUEUES_ENABLED`                           | `true`                                |

`PORT` is injected by Railway; the API honours it. Health check: `GET /api/health` (returns 503 if MongoDB is not ready).

6. Deploy and confirm:
   - `https://YOUR-API.up.railway.app/api/health` returns `{"status":"ok","database":"up"}`.
   - API logs show the MongoDB replica set name.
7. Generate a public Railway domain or attach `api.yourdomain.com`.

## First production administrator

Do **not** run the demo seed in production. Bootstrap the first platform administrator once:

```bash
BOOTSTRAP_LAB_CODE=PLATFORM \
BOOTSTRAP_LAB_NAME="Platform Operations" \
BOOTSTRAP_ADMIN_NAME="System Administrator" \
BOOTSTRAP_ADMIN_EMAIL="admin@yourdomain.com" \
BOOTSTRAP_ADMIN_PASSWORD="<at least 12 characters>" \
pnpm bootstrap:superadmin
```

For Railway, run the compiled bootstrap as a one-off command in the API service:

```bash
node dist/seed/bootstrap-superadmin.js
```

Provide the `BOOTSTRAP_*` variables as one-off variables, then remove `BOOTSTRAP_ADMIN_PASSWORD` after the account is created. The bootstrap is intentionally one-time: it refuses to run if the laboratory already exists.

Sign in at `/login` with the bootstrap laboratory code, admin email and password, then onboard hospitals through `/super-admin`.

## Environment ownership

- Frontend variables: Vercel Production (and Preview if needed).
- Backend secrets: Railway API service only.
- Never put `JWT_*`, `MONGODB_URI`, `REDIS_URL`, SMTP or payment keys in `NUXT_PUBLIC_*` variables; anything prefixed `NUXT_PUBLIC_` is shipped to browsers.
- Vercel and Railway Git integrations redeploy on pushes to `main`.
- `.github/workflows/ci.yml` verifies format, lint, typecheck, unit tests, build and static generation before merge.

## Post-deploy smoke test

1. Open `/landing`; support, trial and department demo forms submit.
2. `GET /api/health` returns 200.
3. Login as the bootstrap super admin; onboard a test hospital/lab.
4. Accept the invitation at `/portal/accept-invite`, configure `/admin`, add staff.
5. Login to the new lab using its lab code.
6. Verify a result PDF, portal login and audit entries.
7. Check Railway volume contains `/data/storage/results` after generating a PDF.

## Known infrastructure requirements

- **MongoDB must be a replica set**; Atlas is the simplest production choice.
- **Redis is required** for BullMQ notification/report queues.
- **Railway volume** is required for PDF persistence unless storage is later moved to object storage.
- **HL7 MLLP** on port 2575 needs a separate Railway TCP proxy if used. The HTTP API and MLLP cannot share a single public TCP port; enable only when required.
- **CORS** is strict. Vercel preview URLs are different origins; add each preview origin or use a stable production domain.
- Payment and notification providers remain in `mock`/`outbox` until real credentials and delivery tests are complete.
