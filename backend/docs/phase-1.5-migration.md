# Phase 1.5 migration — multi-discipline foundation

Phase 1.5 is a structure-only release. It does **not** change histopathology clinical behaviour, accession numbers, barcodes, custody rules, report versions, audit entries, existing endpoints or existing shared type names.

## What changed

### Backend layout

```
apps/api/src/
  core/                    auth, labs, users, patients, cases, test-requests,
                           specimens, custody, audit, worklist, reports, labels,
                           dashboard, notifications, jobs, discipline
  disciplines/
    histopathology/        blocks, slides, protocols, PDF, histo scan/locator,
                           case artifacts, label artifacts, report ports
    haematology/           definition + state machine + result skeleton
    chemistry/             definition + state machine + result skeleton
    microbiology/          definition + state machine + result skeleton
  extensions/              already-built later-roadmap modules retained:
                           portal, inventory, QA, billing, FHIR, HL7, WSI,
                           terminology, sync
  common/                  config, database, context, guards, serializers, utils
```

`core` does not import `disciplines`. It uses registries/ports:

| Port                    | Core consumer                   | Histopathology adapter                                |
| ----------------------- | ------------------------------- | ----------------------------------------------------- |
| `StateMachineRegistry`  | shared domain + scan            | histo SPECIMEN/BLOCK/SLIDE machines                   |
| `DisciplineRegistry`    | guards, definitions             | histo definition                                      |
| `CaseArtifactRegistry`  | case detail, worklist           | blocks/slides + worklist slide metrics                |
| `LabelArtifactRegistry` | labels                          | block/slide label data                                |
| `ReportPortRegistry`    | reports, jobs                   | protocol catalog, PDF renderer, slide/block finalizer |
| `CustodyPortRegistry`   | custody scan/locator controller | histo barcode, scan and locator                       |
| `TestRequestsService`   | cases, custody, reports         | histo request created at accession                    |

The frontend keeps every existing URL. Histopathology-only pages/components/composables use a Nuxt route group (`pages/(histopathology)/...`) and `disciplines/histopathology/`; `/reports/:caseId` and `/admin/protocols` are unchanged.

### New collection: `test_requests`

New collection only; no existing collection renamed.

```
labId, caseId, accessionNumber, discipline, code, name,
status, priority, requestedBy, requestedAt, createdAt, updatedAt
```

Indexes: unique `(labId, caseId, discipline, code)`, `(labId, discipline, status, priority)`, `(labId, accessionNumber)`.

Every new accession creates one request for the selected discipline (default `HISTOPATHOLOGY`, code `HISTO`). The case status remains authoritative. The request status is a projection: `RECEIVED`, `IN_PROGRESS`, `PENDING_REVIEW`, `VERIFIED`, `RELEASED`.

### New/updated fields

**`labs`**

- `enabledDisciplines: Discipline[]` — default and backfill `["HISTOPATHOLOGY"]`.
- `accessionPrefixes: Partial<Record<Discipline, string>>` — default `{}`. Empty means use `accessionPrefix`.
- Existing `accessionPrefix`, `accessionFormat` and all accession counters are unchanged. Histopathology keeps the same yearly counter; other disciplines use a discipline-scoped counter when enabled.

**`users`**

- `disciplines: Discipline[]` — clinical roles require/assign it; lab-wide roles ignore it.
- New roles: `PHLEBOTOMIST`, `SCIENTIST`.
- Existing roles and permissions are unchanged.

**API auth**

- Access tokens/me responses now include `user.disciplines` and `lab.enabledDisciplines`.
- `DisciplineGuard` checks both lab enablement and user assignment. Public/histopathology verification routes are exempt through the existing public marker.

### New API endpoints

```
GET /api/test-requests?caseId=&discipline=&status=&page=&limit=
GET /api/test-requests/case/:caseId
```

No existing endpoint was renamed. Case detail now also returns `testRequests` and `disciplines`; worklist items return `testRequests`. These are additive fields.

### New academic state machines

Registered in `StateMachineRegistry`:

- Haematology/Chemistry sample: `COLLECTED > RECEIVED > ANALYSING > RESULTED > VERIFIED > RELEASED`, plus `REJECTED`, `RERUN_REQUESTED`.
- Microbiology culture: `RECEIVED > PLATED > INCUBATING > READ > ID_DONE > AST_DONE > REPORTED`, plus `REJECTED`; `READ` can repeat via `INCUBATING`.

Histopathology transitions are unchanged and remain the only active workflow in Phase 1.5.

## Deploy order and backfill

1. **Back up MongoDB.** The migration writes only new fields/collection documents; it never deletes or renames.
2. Deploy the Phase 1.5 API. It can serve old auth tokens; missing discipline claims fall back safely.
3. Run the idempotent backfill:

```bash
pnpm migrate:phase15
# or, after a production build / inside the API image:
pnpm migrate:phase15:prod
# equivalent: node apps/api/dist/migrations/phase15-backfill.js
```

The script:

- sets `labs.enabledDisciplines = ["HISTOPATHOLOGY"]` and `labs.accessionPrefixes = {}` when absent;
- adds `disciplines = ["HISTOPATHOLOGY"]` to existing clinical users with none;
- creates one `HISTOPATHOLOGY/HISTO` test request per case that has none, deriving status from the case.

4. Deploy the web app. Navigation filters histology items when the lab/user cannot access them; existing labs remain histology-enabled.
5. Run `pnpm seed:reset` only in demo/test environments. Production never needs a reseed.

### Rollback

The API can be rolled back independently: `test_requests` and the new lab/user fields are additive. Old API versions ignore them. Do not drop `test_requests` if later phases have started; archive or leave it in place.

## Verification

Phase 1.5 was verified with:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`
- API unit tests: 17 passing (state machines, report workflow, registry)
- API E2E: 17 passing, including existing histopathology end-to-end plus TestRequest, discipline guard and label-provider checks
- Web production build with route groups
- Docker seed: 30 cases, 30 histopathology TestRequests

## Deferred to Phase 2

- test/analyte catalogue, panels, reference ranges and result entry
- rules engine
- haematology and chemistry result workspaces
- QC/Levey-Jennings/Westgard
- cumulative patient report
- any change to histopathology workflow or existing endpoints
