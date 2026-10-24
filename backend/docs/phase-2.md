# Phase 2 — results, rules and quality control

Phase 2 extends the shared core with tenant-configurable diagnostic data for haematology and chemical pathology. Histopathology remains unchanged; it continues to use synoptic reports.

## Catalogue as data

New collections:

- `test_definitions` — discipline, code, name, specimen type, method, analytes.
- `panels` — named groups of test codes.

Each analyte carries a result type (`NUMERIC`, `CODED`, `TEXT`, `CALCULATED`), unit, decimals, reference ranges by age/sex, critical limits and an optional arithmetic formula. Formulas are evaluated by a small recursive-descent parser, never `eval`/`Function`.

Admins manage definitions at `/admin/catalog` and through `/api/catalog/tests` and `/api/catalog/panels`. The starter seed includes FBC, reticulocytes, coagulation, ESR, EUC, LFT, lipids, HbA1c and CRP.

## Result entry with append-only versions

New collections:

- `result_sets` — current state per test request (`DRAFT`, `RESULTED`, `VERIFIED`, `RELEASED`, `CANCELLED`).
- `results` — immutable append-only versions. Update/delete middleware throws.

Every save writes a version, recalculates reference flags, critical values and calculated analytes, and updates the linked `TestRequest` lifecycle. Results are locked after verification.

`/results` provides a discipline-scoped worklist and structured editor. Verification is separated from release. Critical results require a documented acknowledgement before verification.

## Rules engine

New collections:

- `rules` — tenant/discipline/test rules with JSON condition and action arrays.
- `rule_executions` — every evaluation, matched or not.

The evaluator supports `all`, `any`, `not`, field paths, `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `between`, `contains` and `exists`. It never evaluates JavaScript.

Actions:

| Action               | Behaviour                                                    |
| -------------------- | ------------------------------------------------------------ |
| `AUTO_VERIFY`        | Verify a complete, non-critical result when conditions match |
| `CRITICAL_ALERT`     | Mark the result for critical acknowledgement                 |
| `REFLEX_TEST`        | Add a new TestRequest for the configured code                |
| `DELTA_CHECK`        | Compare the current value against the last verified result   |
| `CASCADE_ANTIBIOTIC` | Schema/action support for microbiology Phase 4               |
| `REQUIRE_REVIEW`     | Keep the result in the review workflow                       |

Every matched rule writes an audit entry naming the rule and actions. The UI exposes rule configuration at `/admin/rules` and executions alongside each result.

## Quality control

New collections: `qc_materials` and `qc_runs`.

- Materials are lot/level/analyte-specific with a target mean and SD.
- Runs store points, z-scores, status and violations.
- Levey-Jennings chart at `/qc`.
- Westgard rules: 1₃s, 2₂s, R₄s, 4₁s and 10x. Rejected runs remain visible for review.

## Cumulative patient record

`GET /api/results/cumulative/:patientId` returns verified/released results grouped by discipline and test, with latest and historical values. `/patients/:id/cumulative` renders a printable cross-discipline cumulative report.

## API additions

```
GET  /api/catalog/tests | /catalog/panels
POST /api/catalog/tests | /catalog/panels
PATCH /api/catalog/tests/:id
GET  /api/results/worklist?discipline=
POST /api/results
GET  /api/results/:id
PATCH /api/results/:id
GET  /api/results/:id/versions | /executions
POST /api/results/:id/verify | /release | /acknowledge-critical
GET  /api/results/cumulative/:patientId
GET/POST /api/rules
GET  /api/rules/executions
GET/POST /api/qc/materials
GET/POST /api/qc/runs
```

## Seed demonstration

The seed adds eight starter tests, three panels, four rules, three QC materials and three non-histopathology cases. The first FBC case has a released result so the cumulative view is populated immediately.

## Tests

- Unit: 26 passing (rules evaluator, calculated fields, Westgard, state machines, report workflow, discipline registry).
- E2E: 18 passing, including catalogue creation, FBC result/rule/reflex, critical potassium acknowledgement, QC accepted/rejected runs and cumulative history.
