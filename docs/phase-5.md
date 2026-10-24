# Phase 5 — quality management and send-outs

Phase 5 completes the quality layer around existing inventory and QA modules.

## Equipment and temperature logs

New collections: `equipment`, `temperature_logs`.

- Equipment carries code, type, serial, location, status and calibration dates.
- Temperature readings store the allowed range and an in-range/out-of-range decision.
- `/quality` shows equipment, recent readings and a recording form.
- Out-of-range readings remain visible and can be escalated into a non-conformance.

## Non-conformances and CAPA

New collections: `non_conformances`, `capa_actions`.

- Coded non-conformance with category, severity, description, assignee, due date, root cause and status (`OPEN`, `INVESTIGATING`, `CAPA`, `CLOSED`).
- CAPA actions carry action, owner, due date and status (`OPEN`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`).
- Adding a CAPA moves an open non-conformance to `CAPA`.
- Every event is audited.

## Cross-lab send-outs

New collection: `send_outs`.

- A TestRequest is referred to a reference laboratory with reason, courier and tracking number.
- Lifecycle: `SENT → IN_TRANSIT → RECEIVED → REPORTED`, or `CANCELLED`.
- Receipt/report timestamps are recorded; reporting marks the local TestRequest `VERIFIED`.
- One send-out per TestRequest, enforced by a unique index.

## API

```
GET/POST /api/quality/equipment
GET/POST /api/quality/equipment/:id/temperature
GET/POST /api/quality/nonconformances
PATCH    /api/quality/nonconformances/:id
POST     /api/quality/nonconformances/:id/capa
GET/POST /api/quality/send-outs
PATCH    /api/quality/send-outs/:id
```

## Seed and tests

Seed: two refrigerators/freezers, three temperature readings (including an excursion), one MAJOR non-conformance with CAPA, and one active send-out to a reference laboratory.

Unit: 26 passing. E2E: 21 passing, including equipment/temperature, non-conformance + CAPA and the complete send-out lifecycle.
