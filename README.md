# Histopathology LIMS

**Phase 1 — core tracking and reporting.** A block-and-slide level laboratory information management system for hospital histopathology departments, designed Nigeria-first for low-resource, low-bandwidth laboratories.

Most LIMS stop at the specimen. This one follows the physical work: a specimen becomes cassettes, cassettes become slides, and every movement is an immutable custody event. Status is never typed in — it is derived by a state machine from the last scan. Pathologists get a prioritised worklist, structured synoptic reporting, server-rendered PDFs with verification QR codes, and reports that lock on sign-out.

![Dashboard in light mode](docs/screens/dashboard-light.webp)

| Worklist                                                 | Case file                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Pathologist worklist](docs/screens/worklist.webp)      | ![Case detail and custody timeline](docs/screens/case-detail.webp) |
| **Scan station**                                         | **Synoptic report**                                                |
| ![Grossing scan station](docs/screens/scan-station.webp) | ![Signed synoptic report](docs/screens/report-editor.webp)         |

---

## What Phase 1 delivers

| Requirement                                          | Implementation                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, JWT access + refresh, role guards, lab tenancy | Rotating refresh tokens, bcrypt passwords, role + capability guards, tenant context enforced by a Mongoose plugin                                                                        |
| Accessioning                                         | Atomic patient + case + specimen creation, configurable accession format (`HP-2026-000123`), auto-MRN, priorities and TAT windows                                                        |
| Barcodes and labels                                  | Unique Data Matrix/QR payloads, 50 × 25 mm print-ready PDF, ZPL output, SVG preview                                                                                                      |
| Custody tracking                                     | Seven scan stations, keyboard-wedge first, instant visual + audible feedback, invalid transitions rejected with the allowed next states                                                  |
| Specimen locator                                     | Any specimen/block/slide barcode → current station, hierarchy and full append-only timeline                                                                                              |
| Grossing and microtomy                               | Gross descriptions, block creation, slide cutting, special-stain requests, recut requests, specimen rejection                                                                            |
| Pathologist worklist                                 | Frozen → urgent → routine, then TAT deadline; filters and live countdowns; warning at 80% of the window                                                                                  |
| Synoptic reporting                                   | Four seeded cancer protocols (breast, colorectal, prostate, cervix), dynamic required-field validation, auto-generated narrative, version history, lock on sign-out, reasoned amendments |
| PDF report                                           | Lab letterhead, synoptic narrative, signature block, QR verification, Unicode fonts, page numbering, draft watermark                                                                     |
| Dashboard                                            | Cases by status and priority, TAT by stage, overdue breach watch, pathologist workload, recent accessions                                                                                |
| Audit                                                | Every create, update, scan, sign-out and amendment with actor, before/after values, IP/user agent and request ID                                                                         |
| Offline resilience                                   | Installable PWA, cached app shell and offline screen, compressed assets, no heavy UI library. Offline clinical writes arrive in Phase 3 by design                                        |
| Quality                                              | Strict TypeScript, Zod contracts shared by both apps, class-validator DTOs, Swagger, unit + E2E tests, ESLint and Prettier                                                               |

## Architecture

```mermaid
flowchart LR
  Browser["Nuxt 3 SPA / PWA<br/>tablet + desktop + scan stations"] -->|"REST /api · JWT"| API["NestJS API<br/>role + tenant context"]
  API --> Mongo[("MongoDB replica set<br/>transactions")]
  API --> Redis[("Redis")]
  Redis --> Workers["BullMQ workers<br/>PDF · TAT checks · notification stubs"]
  API --> Disk[("PDF / label storage")]
  Workers --> Mongo
  Browser -. "cached shell only" .-> SW["Service worker"]
```

**Monorepo**

```
apps/
  api/        NestJS: auth, labs, users, patients, cases, specimens,
              blocks, slides, custody, worklist, reports, protocols,
              labels, dashboard, audit, pdf, jobs
  web/        Nuxt 3: app shell, accessioning, scan station, worklist,
              locator, synoptic editor, admin, verification
packages/
  shared/     Domain vocabulary, state machines, Zod schemas, API types,
              TAT + accession formatting, protocol validation/narrative
docker/       Mongo replica-set initialiser
docs/         Architecture notes and screenshots
```

See [docs/architecture.md](docs/architecture.md) for the request lifecycle, tenancy enforcement, transaction boundaries, indexes and design trade-offs.

### Domain hierarchy

```
Patient → Case (accession) → Specimen → Block (cassette) → Slide
```

Every physical action is a `custody_events` document:

```
entityType · entityId · eventType · station · fromState → toState
user · timestamp · labId · metadata
```

Custody events, audit logs and signed report versions are **append-only** at the Mongoose layer — update and delete middleware throws.

### Physical state machine

```
ACCESSIONED → GROSSED → PROCESSING → EMBEDDED → CUT → STAINED
            → WITH_PATHOLOGIST → REPORTED → ARCHIVED

CUT / STAINED / WITH_PATHOLOGIST → RECUT_REQUESTED → CUT → STAINED
Any pre-archive state → REJECTED  (slides may recover into STAINED)
```

Case states are separate:

```
RECEIVED → IN_PROGRESS → PENDING_REVIEW → REPORTED → AMENDED
```

Stations infer the next event from the scanned entity and its current state. The API returns `409` with the legal next states when a scanner fires out of order.

### Multi-tenancy

`labId` is added to every tenant collection by a Mongoose plugin and injected into **every** read, write and aggregation from a verified JWT. There is no `labId` request parameter to forget or tamper with. Cross-tenant ids resolve as `404`. The only bypass is an explicitly scoped system context used for public report verification and the seed script.

### Transactions

Accessioning, grossing, slide cutting, scans, report sign-out and amendments run in MongoDB transactions. That is why Docker Compose runs Mongo as a replica set. A scan updates the entity projection, appends the custody event, advances the case and writes the audit entry together.

## Quick start — Docker

Prerequisites: Docker with Compose v2.

```bash
# Optional: local overrides for secrets and ports
cp .env.example .env

docker compose up -d --build
docker compose --profile tools run --rm seed
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api>
- Swagger: <http://localhost:4000/docs>
- Health: <http://localhost:4000/api/health>

The `seed` profile is a one-shot container. It drops and rebuilds the sample dataset when `SEED_RESET=true`, which is the default for that command. Use `docker compose down -v` to remove Mongo/Redis/PDF volumes entirely.

Docker services use local development defaults. Set real secrets in `.env` or your orchestrator for any shared environment, and run the API with `NODE_ENV=production` there. Environment validation rejects development secrets in production.

## Quick start — local development

Prerequisites: Node.js 22.12+, pnpm 12+, Docker (for Mongo/Redis).

```bash
cp .env.example .env
docker compose up -d mongo mongo-init redis

pnpm install
pnpm seed:reset
pnpm dev
```

`pnpm dev` builds the shared package, then runs the shared watcher, API (`:4000`) and Nuxt (`:3000`) together.

If Redis is not available, set `QUEUES_ENABLED=false`. PDF generation and notification stubs then run inline; custody and reporting remain fully functional.

### Demo accounts

All seeded users share one lab, **HISTO**. Passwords are shown for local demonstration only.

| Role                        | Email                   | Password            |
| --------------------------- | ----------------------- | ------------------- |
| Super administrator         | `superadmin@histo.ng`   | `SuperAdmin#2026`   |
| Lab administrator           | `admin@histo.ng`        | `LabAdmin#2026`     |
| Receptionist                | `reception@histo.ng`    | `Reception#2026`    |
| Grossing officer            | `grosser@histo.ng`      | `Grosser#2026`      |
| Medical lab scientist       | `technologist@histo.ng` | `Technologist#2026` |
| Pathologist (breast/GI)     | `pathologist@histo.ng`  | `Pathologist#2026`  |
| Pathologist (urology/gynae) | `pathologist2@histo.ng` | `Pathologist#2026`  |
| Referring clinician         | `referrer@clinic.ng`    | `Referrer#2026`     |

The seed creates 30 realistic cases across received, grossed, processing, embedded, cut/stained, pending review, reported, amended and archived stages, with custody histories, draft reports and signed reports (two amended). Try scanning `BL-HP-2026-000004-A1` at the grossing station, or use the specimen locator with that barcode.

The referring clinician account is intentionally limited to the Phase 2 notice page; the referral portal is not part of Phase 1.

## Environment variables

| Variable                             | Default                                                                     | Purpose                                       |
| ------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------- |
| `NODE_ENV`                           | `development`                                                               | `production` rejects development JWT secrets  |
| `API_PORT` / `API_PREFIX`            | `4000` / `api`                                                              | API listener and global route prefix          |
| `CORS_ORIGINS`                       | `http://localhost:3000`                                                     | Comma-separated allowed browser origins       |
| `PUBLIC_WEB_URL` / `PUBLIC_API_URL`  | localhost                                                                   | Used in PDF verification links and docs       |
| `MONGODB_URI`                        | `mongodb://localhost:27017/histo_lims?replicaSet=rs0&directConnection=true` | Must point at a replica set                   |
| `REDIS_URL`                          | `redis://localhost:6379`                                                    | BullMQ connection                             |
| `QUEUES_ENABLED`                     | `true`                                                                      | `false` runs PDF/notifications inline         |
| `JWT_ACCESS_SECRET`                  | — (required, 32+ chars)                                                     | Access-token signing key                      |
| `JWT_REFRESH_SECRET`                 | — (required, 32+ chars)                                                     | Refresh-token signing key                     |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `7d`                                                                | Token lifetimes (`s`, `m`, `h`, `d`)          |
| `STORAGE_DIR`                        | `./storage`                                                                 | Generated report PDFs; mount a durable volume |
| `SWAGGER_ENABLED`                    | `true`                                                                      | Serve OpenAPI docs at `/docs`                 |
| `LOG_LEVEL`                          | `info`                                                                      | Pino level                                    |
| `NUXT_PUBLIC_API_BASE`               | `http://localhost:4000/api`                                                 | Browser-facing API base                       |
| `NUXT_PUBLIC_WEB_BASE`               | `http://localhost:3000`                                                     | Browser-facing web base                       |
| `NUXT_PUBLIC_APP_NAME`               | `Histopathology LIMS`                                                       | Shell label                                   |
| `SEED_RESET`                         | `false`                                                                     | Allow the seed script to drop the database    |

The API validates the environment with Zod at startup and fails fast on missing or unsafe values. In local development both apps read the repository-root `.env`; in Docker, Compose injects the values.

## Scripts

| Command                               | What it does                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | Shared watcher + API + web                                                                                     |
| `pnpm build`                          | Build shared, API and web                                                                                      |
| `pnpm typecheck`                      | Strict TypeScript across all workspaces                                                                        |
| `pnpm lint` / `pnpm format:check`     | ESLint / Prettier checks                                                                                       |
| `pnpm test:unit`                      | Custody state machine and report sign-out policy tests                                                         |
| `pnpm test:e2e`                       | MongoDB replica-set E2E: accession → blocks → scans → slides → report → PDF → amendment, plus tenant isolation |
| `pnpm verify`                         | Lint + typecheck + unit + E2E + full build                                                                     |
| `pnpm seed` / `pnpm seed:reset`       | Seed only if empty / drop and reseed                                                                           |
| `pnpm db:up` / `pnpm db:down`         | Local Mongo replica set + Redis                                                                                |
| `pnpm docker:up` / `pnpm docker:seed` | Compose stack / one-shot seed                                                                                  |

### API surface (abridged)

```
POST   /api/auth/login | /refresh | /logout        GET /api/auth/me
POST   /api/cases/accession                        GET /api/cases[/:id]
PATCH  /api/cases/:id | /:id/assign
POST   /api/blocks/gross                           POST /api/slides/cut
POST   /api/slides/request | /:id/recut            POST /api/specimens/:id/reject
POST   /api/custody/scan                           GET  /api/custody/locator/:barcode
GET    /api/custody/case/:caseId/timeline
GET    /api/worklist                               POST /api/worklist/:caseId/claim
GET    /api/reports/case/:caseId                   POST /api/reports/case/:caseId
PATCH  /api/reports/:id                            POST /api/reports/:id/sign-out | /amend
GET    /api/reports/:id/pdf                        GET  /api/reports/verify/:code  (public)
GET    /api/labels/:entityType/:id?format=pdf|zpl|svg&symbology=datamatrix|qr
GET    /api/labels/case/:caseId?include=all|specimens|blocks|slides
GET    /api/dashboard                              GET  /api/protocols
GET    /api/users[/pathologists]                   GET  /api/labs/me
GET    /api/audit                                  POST /api/maintenance/tat-check
GET    /api/health  (public)                       Swagger at /docs
```

All endpoints are documented in Swagger with bearer auth, DTOs and error shapes.

## Testing

```bash
pnpm test:unit
pnpm test:e2e
pnpm verify
```

The E2E suite starts an ephemeral MongoDB **replica set** with `mongodb-memory-server`, seeds a second tenant, and proves:

- accessioning generates a formatted accession number and unique specimen barcode
- role checks and invalid scan transitions reject correctly
- a block moves through grossing → processing → embedding → cutting → staining → pathologist
- a complete synoptic report signs out, locks, marks slides/blocks reported and advances the case
- public verification and server-side PDF/label endpoints work
- an amendment creates version 2 and moves the case to `AMENDED`
- a user from another lab gets `404` / an empty list — tenant isolation
- audit log contains scan, sign-out and amendment entries

## Design direction

The visual system is clinical but opinionated: bone and ink surfaces, a single vermilion accent, a serif display face for hierarchy and monospaced metadata for barcodes and statuses. No decorative gradients, no stock dashboard charts. Status chips are readable at a glance in light and dark mode. The scan station deliberately abandons the app shell: full-screen, large type, keyboard-first, green/red feedback and audible confirmation.

Tokens live in [`apps/web/tailwind.config.ts`](apps/web/tailwind.config.ts) and semantic CSS variables in [`apps/web/assets/css/main.css`](apps/web/assets/css/main.css). The app is responsive from 390 px mobile through 1024 px tablet to wide desktop, with accessible labels, focus states and reduced-motion support.

## Security and operations notes

- Access tokens and refresh tokens are held in first-party cookies for the SPA. For a multi-user hospital deployment, proxy the API behind HTTPS and consider moving the refresh token to an `HttpOnly`, `Secure` cookie. Refresh tokens are hashed and rotated server-side.
- The tenant plugin fails closed without request context. Public verification and seeding use an explicit system context.
- Helmet, compression, request IDs, Pino redaction, bcrypt and strict DTO whitelisting are enabled. Rate limiting should be added at the reverse proxy or an API gateway before internet exposure.
- PDFs are written to `STORAGE_DIR`; use an encrypted persistent volume with retention/backup policy. Reports are clinical records — never mount ephemeral container storage in production.
- MongoDB runs without auth in the supplied Compose file for local development only. Use authentication, TLS, a three-member replica set, backups and least-privilege users in production.
- An audit entry is written for each mutation; the audit and custody collections are append-only at the data layer.
- Patient data protection: tune log retention, access reviews and NDPR/NDPA obligations for your jurisdiction. The seed contains fictitious patients only.

## Later phases (not built)

**Phase 2** — referrer portal with magic-link/OTP, status tracking, SMS/WhatsApp/email notifications; reagent and antibody lot inventory linked to stain runs with expiry/validation blocking; QA module with peer-review sampling, second-opinion rules, discrepancy tracking and rejection reason codes.

**Phase 3** — offline-first IndexedDB queue with idempotent event sync and optional on-prem sync server; FHIR R4 (Patient, Specimen, ServiceRequest, DiagnosticReport); HL7 v2 adapter; whole-slide image linking by slide barcode; SNOMED CT / ICD-O-3 lookups; Paystack/Flutterwave payments and HMO claims export.

The current schema already carries stable barcode identifiers, protocol snapshots, immutable report versions and lab-scoped notifications so these phases can be added without rewriting Phase 1.

## Conventional commits

This repository follows conventional commits (`feat(api):`, `fix(web):`, `test:`, `chore:`, `docs:`). Examples:

```
feat(api): enforce custody transitions in scan transactions
feat(web): add keyboard-first grossing scan station
test(api): cover sign-out lock and amendment versioning
docs: add local and Docker setup
```

## License

Proprietary / unlicensed. All rights reserved.
