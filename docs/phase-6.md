# Phase 6 — interoperability and offline instrumentation

Phase 6 completes the integration surface. Most baseline adapters existed earlier; this phase adds the instrument connector agent and revalidates them together.

## Instrument connector

- `POST /api/instruments/messages` accepts raw ASTM or HL7 v2 ORU messages.
- `GET /api/instruments/messages` lists raw/parsed messages, status and matching accession.
- Parsers extract accession, patient name, test code, result values and units.
- A message is `MATCHED` when its accession belongs to a TestRequest in the authenticated laboratory, otherwise `UNMATCHED` with an explicit reason.
- `backend/connector/index.mjs` is a Node agent for serial/TCP gateways: it logs in, reads an ASTM/HL7 file or stdin, and posts the raw message to the LIMS.

Example:

```bash
LIMS_URL=http://localhost:4000/api LIMS_LAB_CODE=HISTO \
LIMS_EMAIL=scientist@histo.ng LIMS_PASSWORD='Scientist#2026' \
node backend/connector/index.mjs --protocol ASTM --file analyzer.astm
```

## Existing adapters revalidated

- Offline scan queue and idempotent `/api/sync/batch`.
- FHIR R4 Patient/ServiceRequest/Specimen/DiagnosticReport.
- HL7 v2 ORM/OML order intake + ORU output/MLLP.
- WSI barcode linking + HMAC scanner webhook.
- SNOMED CT / ICD-O-3 search and report coding.
- Admin integration contract page at `/admin/integrations`.
- E2E still exercises FHIR, WSI and HL7 alongside the new instrument ingestion.

## Testing

- Unit: 28 passing, including ASTM/HL7 parser coverage.
- E2E: 22 passing, including ASTM ingestion with accession matching.
