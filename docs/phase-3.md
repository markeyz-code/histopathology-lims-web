# Phase 3 — multi-discipline reporting, delivery and pre-analytical flow

Phase 3 turns verified results into deliverable reports and adds the collection-to-laboratory chain.

## Multi-discipline PDFs

- `GET /api/results/:id/pdf` renders a per-result PDF with lab letterhead, patient/accession identity, analyte table, flags, reference ranges, comment and verification block.
- `GET /api/results/cumulative/:patientId/pdf` renders a cross-discipline cumulative report.
- `/results` and `/patients/:id/cumulative` expose PDF download actions.
- Result PDFs are generated from the immutable verified/released row and work for haematology, chemistry and future microbiology.

## Delivery and referral portal

- Releasing a result now queues an `IN_APP`/`EMAIL`/`WHATSAPP` notification to the referring clinician using the existing notification outbox/adapters.
- The referral portal exposes released result summaries on the case list and detail pages.
- `GET /api/portal/results/:id/pdf` allows a referrer to download only a released result belonging to their own case.
- Histopathology report release/notification behaviour is unchanged.

## Pre-analytical flow

New collections:

- `collection_centres` — walk-in or home-collection hubs.
- `consignments` — a rider handoff with sample IDs and custody state.

Consignment lifecycle: `CREATED → DISPATCHED → RECEIVED` or `REJECTED`. Creating a consignment writes `collectionCentreId` and `consignmentId` onto each TestRequest. Dispatch records the handoff timestamp; receipt returns the requests to `RECEIVED` or cancels them on rejection. Every action writes an audit entry.

UI: `/preanalytics` — collection centres, consignments, dispatch and laboratory receipt.

## Billing and payments

The existing invoice, Paystack/Flutterwave, manual receipt and HMO claims modules are retained and validated for multi-discipline results. They remain outside the core discipline modules.

## API additions

```
GET  /api/results/:id/pdf
GET  /api/results/cumulative/:patientId/pdf
GET  /api/portal/results/:id/pdf
GET/POST /api/preanalytics/centres
GET/POST /api/preanalytics/consignments
POST /api/preanalytics/consignments/:id/dispatch
POST /api/preanalytics/consignments/:id/receive
```

## Seed

The demo adds the Ikeja collection hub. Phase 2's released FBC result exercises the cumulative PDF and portal result path.

## Testing

- 26 unit tests (unchanged).
- 19 E2E tests, now including result/cumulative PDF generation and the full collection-centre consignment cycle.
