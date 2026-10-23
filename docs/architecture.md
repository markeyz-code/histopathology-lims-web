# Architecture notes

> This document covers the Phase 1 core. Phase 2/3 modules — referral portal, notifications, inventory, QA, offline sync, FHIR/HL7, WSI, terminology and billing — are documented in [phase-2-3.md](phase-2-3.md).

This document records the structural decisions behind Phase 1. It is intentionally narrower than the product README: the focus is how the software keeps a physical specimen's history correct.

## 1. Runtime topology

```
Browser (Nuxt 3 SPA + PWA)
   │  fetch /api, bearer access token
   ▼
NestJS API
   ├── global JwtAuthGuard → RolesGuard
   ├── request context (request id, ip, user agent)
   ├── tenant context (labId from verified JWT)
   ├── domain services
   └── Mongoose + tenant plugin
          │
          ├── MongoDB replica set (transactions, append-only collections)
          ├── Redis / BullMQ (PDF, TAT checks, notification stubs)
          └── STORAGE_DIR (generated PDFs)
```

The API is stateless. The web app is an SSR-disabled Nuxt SPA served by Nitro; every page is lazy-loaded and the PWA caches only the application shell and static assets. Clinical API responses are not cached by the service worker because a shared workstation must not leak one clinician's data to another.

## 2. Request lifecycle and tenancy

1. `RequestContextMiddleware` assigns or trusts a validated `x-request-id`, then wraps the request in an `AsyncLocalStorage` context containing request id, IP, user agent and path.
2. `TenantMiddleware` verifies the bearer access token with the access secret and stores `{ labId, userId, userName, role }` in a second `AsyncLocalStorage`. No header, query or body value can change the lab.
3. `JwtAuthGuard` skips `@Public()` routes, otherwise Passport verifies the token and `JwtStrategy` re-reads the user in the tenant context.
4. `RolesGuard` checks `@Roles(...)` against the authenticated role. `SUPER_ADMIN` is permitted within its own laboratory; there is no cross-lab super-user read path in Phase 1.
5. Services run domain logic. Every tenant collection has the tenant plugin.

### The tenant plugin

`apps/api/src/common/database/tenant.plugin.ts` adds an immutable, required, indexed `labId` to every tenant schema and:

- injects `labId` into all `find`, `count`, `distinct`, `update`, `delete` and `replace` query filters;
- prepends `$match: { labId }` to aggregation pipelines;
- sets `labId` on `validate`/`insertMany` when a document is created;
- rejects attempts to modify `labId` or use aggregation-pipeline updates;
- throws `TenantContextMissingError` rather than running an unscoped query.

`labs` itself is not a tenant collection — it is the tenant. Public report verification and the seed script run inside an explicit `runWithSystemTenant` block; this is deliberately the only bypass.

### Async-local contexts

| Context | Owner          | Contains                                    |
| ------- | -------------- | ------------------------------------------- |
| Request | middleware     | request id, method, path, ip, user agent    |
| Tenant  | middleware     | labId, actor id/name/role                   |
| Jobs    | worker wrapper | labId (jobs carry `labId` in their payload) |

Database middleware cannot accidentally see a request-scoped variable from a previous request because Node's `AsyncLocalStorage` is per async chain. BullMQ workers wrap each job in a tenant context before touching a model.

## 3. Schema and collections

| Collection        | Purpose                                                         | Append-only |
| ----------------- | --------------------------------------------------------------- | ----------- |
| `labs`            | lab identity, accession format, TAT rules, letterhead, counters | no          |
| `users`           | staff + referrer accounts; password/refresh hashes select:false | no          |
| `patients`        | lab-scoped MRN and demographics                                 | no          |
| `cases`           | accession, patient link, priority, case status, TAT deadline    | no          |
| `specimens`       | specimen sequence/label/barcode, gross description              | no          |
| `blocks`          | cassette label/barcode, status projection, slide count          | no          |
| `slides`          | slide label/barcode, stain, status projection                   | no          |
| `custody_events`  | every physical action                                           | **yes**     |
| `reports`         | current synoptic report + protocol snapshot                     | no          |
| `report_versions` | immutable signed versions                                       | **yes**     |
| `protocols`       | versioned synoptic template definitions                         | no          |
| `audit_logs`      | actor/before/after/request metadata                             | **yes**     |
| `notifications`   | Phase 1 notification stubs                                      | no          |

Indexes are created from the schemas. Key examples:

- `cases { labId, accessionNumber }` unique
- `cases { labId, status, priorityRank, tatDeadline }` for worklist ordering
- `blocks/slides/specimens { labId, barcode }` unique
- `slides { labId, status }` for worklist counts
- `custody_events { labId, entityType, entityId, timestamp }` for timelines
- `custody_events { labId, caseId, timestamp }` for case timelines
- `reports { labId, caseId }` unique
- `report_versions { labId, reportId, version }` unique
- `audit_logs { labId, createdAt }`, `{ labId, entityType, entityId }`

`verificationCode` is globally unique with a partial index; the public verification route intentionally bypasses tenant scoping to resolve a code, then returns only minimal report metadata.

## 4. Custody model

`CustodyEvent` is written in the same transaction as the projected status update. The projection exists for fast querying, but it is never accepted from the client. The event carries `fromState`/`toState`, station, actor, time, barcode and metadata.

```
Client scan
  → resolve barcode
  → role check for station
  → infer target state or explicit REJECT / RECUT
  → state-machine validation
  → atomic findOneAndUpdate({_id, status: previousStatus})
  → append custody event
  → advance case if needed
  → audit record
  → commit
```

If the atomic update matches nothing (another station scanned the same entity first), the API returns `409` with a "refresh and scan again" message. The scan is never retried automatically.

### Physical transitions

| Entity   | Transitions                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specimen | `ACCESSIONED → GROSSED → ARCHIVED`; `REJECTED` from active states                                                                                         |
| Block    | `ACCESSIONED → GROSSED → PROCESSING → EMBEDDED → CUT → REPORTED → ARCHIVED`; `REJECTED` from active states                                                |
| Slide    | `ACCESSIONED → CUT → STAINED → WITH_PATHOLOGIST → REPORTED → ARCHIVED`; `WITH_PATHOLOGIST/STAINED → RECUT_REQUESTED → CUT`; `REJECTED → STAINED/ARCHIVED` |

Station inference:

| Station          | Specimen | Block      | Slide            |
| ---------------- | -------- | ---------- | ---------------- |
| Grossing         | GROSSED  | GROSSED    | —                |
| Processing       | —        | PROCESSING | —                |
| Embedding        | —        | EMBEDDED   | —                |
| Microtomy        | —        | CUT        | CUT (recut)      |
| Staining         | —        | —          | STAINED          |
| Pathologist desk | —        | —          | WITH_PATHOLOGIST |
| Archive          | —        | ARCHIVED   | ARCHIVED         |

Case transitions are separate and are a projection of the case event stream:

```
RECEIVED → IN_PROGRESS → PENDING_REVIEW → REPORTED → AMENDED
```

Grossing advances the case to `IN_PROGRESS`; a slide reaching the pathologist desk or a draft report advances it to `PENDING_REVIEW`; sign-out advances it to `REPORTED`; an amendment moves it to `AMENDED`. Scans cannot regress a case.

## 5. Transactions

`withTransaction(connection, work)` wraps work in `session.withTransaction`. It is used for:

- accessioning (lab counter, patient resolution/creation, case, specimens, case/specimen events, audit)
- grossing (blocks, block events, specimen event/status, case summary, case transition, audit)
- slide cutting (block state, slide rows, slide events, case summary, audit)
- scan (entity update, event, case transition, last-scanned timestamp, audit)
- sign-out (report lock/version row, slide/block projections, case status, audit)
- amendment (report version, case status, audit)

MongoDB standalone mode does not support transactions. The API logs a warning at startup if it detects a standalone topology. Docker Compose runs Mongo with `--replSet rs0`; tests use `mongodb-memory-server` as a replica set.

## 6. Reporting lifecycle

```
DRAFT ──sign-out──► SIGNED_OUT ──amend──► AMENDED
  │                     │                   │
  └─ editable            └─ locked           └─ locked; new version only
```

- A protocol snapshot (including its content and version) is stored on the report at creation. Editing a protocol later cannot change a signed report.
- Draft saves validate types/options and may be incomplete. Required-field completeness is tracked and returned.
- Sign-out validates every required field, creates an immutable `report_versions` row, assigns a verification code, locks the report, marks reviewed slides/blocks `REPORTED`, advances the case and writes audit.
- Amendments require a reason (≥10 characters), create a new version, re-sign the report and move the case to `AMENDED`. The original version remains in `report_versions`.
- The PDF is rendered from structured data and the narrative, not from an HTML document. PDFKit with embedded Noto Sans keeps Yoruba/Igbo diacritics intact. Drafts carry a watermark; amendments carry an amended banner and reason.
- The verification QR points to `/verify/<code>` on the web base URL. The public endpoint returns only lab name, accession, patient initials, status, signer and signed date.

### TAT

`receivedAt + lab.tatHours[priority]` is the deadline. Priority windows default to 1 h (frozen), 24 h (urgent), 72 h (routine). The UI warns at `lab.tatWarningPercent` (default 80%). A BullMQ repeatable maintenance job flags active cases whose deadline has passed, sets `tatBreachedAt` and writes a stub notification. The dashboard and worklist compute countdowns server-side and client-side from the same shared helper.

## 7. Background work

| Queue                | Job            | Handler                                               |
| -------------------- | -------------- | ----------------------------------------------------- |
| `lims-reports`       | `generate-pdf` | `PdfService.generateAndStore` inside a tenant wrapper |
| `lims-notifications` | `notify`       | notification stub document                            |
| `lims-maintenance`   | `tat-check`    | TAT breach flagging across active labs                |

`upsertJobScheduler` registers the TAT check every 15 minutes. When `QUEUES_ENABLED=false`, the service runs PDF generation and notification writes inline so low-resource or test environments do not require Redis. Worker failures are logged with Pino and retried with exponential backoff.

## 8. Labels and identifiers

- Accession numbers come from an atomic per-lab counter keyed by year and formatted by the lab's template (`{PREFIX}`, `{YYYY}`, `{YY}`, `{SEQ:n}`).
- MRNs use the same counter mechanism (`mrn-<year>`).
- Specimen/block/slide barcodes are ULID-based, prefixed `SP-`, `BL-`, `SL-`. Labels include a human-readable accession, entity label, patient name, detail/date and a Data Matrix by default (QR optional).
- PDF labels are 50 × 25 mm for direct thermal printers; ZPL uses `^BXN` for Data Matrix and `^BQN` for QR. SVG is available for browser preview.
- Report PDFs use the verification code and QR; labels do not encode PHI beyond the barcode that resolves inside the tenant.

## 9. Error contract

Every API failure returns:

```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Cut cannot move to Processing. Allowed next: Reported, Archived, Rejected.",
  "requestId": "…",
  "timestamp": "2026-10-23T09:19:44.490Z",
  "path": "/api/custody/scan"
}
```

Validation errors may return `message` as an array. MongoDB duplicate keys, cast errors and Mongoose validation errors are mapped to `409`/`400` without leaking internals. Unexpected errors return a generic message plus request id.

## 10. Test strategy

- Unit tests cover the shared state machine and report policy (required fields, lock, amendment).
- E2E starts an ephemeral Mongo replica set and exercises the actual Nest app through HTTP: login, accession, grossing, scans, cutting, staining, report creation, sign-out, PDF, verification, amendment, tenancy isolation, audit, worklist and dashboard.
- Playwright/puppeteer was used during development for visual verification of desktop, tablet and mobile states; screenshots in `docs/screens` are from the seeded demo.

## 11. Deliberate core trade-offs

Phase 2/3 extends this core without changing the append-only custody ledger; see the companion document.

- Access/refresh tokens are stored in first-party cookies for the SPA. An `HttpOnly` refresh cookie requires a same-site proxy and is a production hardening step.
- PDFs live on local disk. A shared object store can replace `STORAGE_DIR` without changing the report model.
- Notifications are database stubs; delivery adapters are Phase 2.
- Offline mode freezes clinical actions and serves the shell offline; the idempotent local event queue is Phase 3.
- Public verification is intentionally minimal and bypasses tenancy only to resolve a high-entropy code.
- The seed contains fictitious Nigerian patients and staff for demonstration; it is not production data.
