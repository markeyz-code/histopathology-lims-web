# Phase 4 — microbiology

Phase 4 adds the culture bench and AST interpretation on top of the shared case/test-request/results foundation.

## Collections

- `organisms` — code, name, Gram reaction, WHONET code.
- `antibiotics` — code, name, class, WHONET code.
- `breakpoint_tables` — CLSI/EUCAST version, organism, antibiotic, method, thresholds, first-line flag.
- `cultures` — case, patient, test request, specimen, plate/media/incubation, organism, colony count, resistance flags, report timestamp.
- `isolates` — identified organism(s) from a culture.
- `susceptibility_results` — antibiotic, method, value, breakpoint reference, S/I/R.

## Culture lifecycle

The existing microbiology state machine is used:

```
RECEIVED → PLATED → INCUBATING → READ → ID_DONE → AST_DONE → REPORTED
```

`READ` can return to `INCUBATING`; `REJECTED` is terminal. Every transition validates against `StateMachineRegistry` and writes an audit entry. Reporting updates the linked TestRequest to `VERIFIED`.

## AST interpretation

`POST /api/micro/cultures/:id/ast` finds the active breakpoint for the isolate organism, antibiotic and method:

- MIC: `value <= susceptibleThreshold` → S; `value >= resistantThreshold` → R; otherwise I.
- Disk: `value >= susceptibleThreshold` → S; `value <= resistantThreshold` → R; otherwise I.

The breakpoint id, standard and unit are stored with the susceptibility row. Resistance flags (`MRSA`, `ESBL`, `VRE`, `CRE`) are derived for matching organism/antibiotic patterns.

## Antibiogram and WHONET

- `GET /api/micro/antibiogram?from=&to=` groups S/I/R by organism and antibiotic with %S.
- `GET /api/micro/antibiotics?organism=EC&cascade=true` returns only first-line agents with an organism breakpoint; omitting `cascade` returns the full panel.
- `GET /api/micro/whonet?from=&to=` returns a semicolon CSV with organism, antibiotic, tested, S/I/R and %S.

## UI

`/microbiology` provides the culture bench, status transitions, isolate identification, AST entry, result table, antibiogram and WHONET download. Organism/antibiotic/breakpoint administration is available through the authenticated API and is intended for the laboratory administrator.

## API

```
GET/POST /api/micro/organisms
GET/POST /api/micro/antibiotics
GET/POST /api/micro/breakpoints
GET/POST /api/micro/cultures
GET/PATCH /api/micro/cultures/:id
POST /api/micro/cultures/:id/isolates
POST /api/micro/cultures/:id/ast
GET /api/micro/antibiogram
GET /api/micro/whonet
```

## Seed and tests

Seed: 5 organisms, 8 antibiotics, 7 CLSI/EUCAST breakpoints and one reported E. coli urine culture with four AST results and antibiogram data.

Unit tests: **26 passing**. E2E: **20 passing**, including the complete culture → identification → MIC AST → antibiogram → WHONET flow.
