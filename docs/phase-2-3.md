# Phase 2 and Phase 3 architecture

Phase 1 remains the source of truth for patient, specimen, block, slide, custody, report and audit records. This document describes how the Phase 2/3 modules attach to that core without weakening its append-only or tenant-scoped guarantees.

## 1. Referral portal

```
Referrer → POST /portal/auth/request {labCode,email}
        ← generic 202 + one-time code/link (debug fields only when PORTAL_DEBUG)
        → POST /portal/auth/verify {labCode,email,code|token}
        ← normal access + refresh session (role REFERRER)
        → GET /portal/cases
        → GET /portal/cases/:id
        → GET /portal/cases/:id/report.pdf   (only when releasedAt is set)
```

- `portal_tokens` stores a SHA-256 hash of a 32-byte magic-link token and a six-digit OTP. Raw values are never persisted.
- Only a `REFERRER` user in the matching laboratory can request a token. The public request response is intentionally generic to avoid account enumeration.
- Requests are limited to three unconsumed tokens per user in ten minutes. Five wrong codes consume the token.
- Tokens are single-use, expire after `PORTAL_TOKEN_TTL_MINUTES` and have a MongoDB TTL index.
- Case ownership is resolved by `referringClinician.referrerUserId` or the lower-cased referral email. Accessioning links a referrer user automatically when the email matches.
- A report is visible only after an explicit release. `POST /reports/:id/release` is restricted to pathologists/lab admins, records `releasedAt`, `releasedBy` and a note, writes a RELEASE audit entry and queues the notification.
- The portal never exposes an unreleased report body or PDF. It does expose status and the custody timeline for the referrer's own cases.
- An amendment clears the release; the amended report must be released again.

## 2. Notifications

`notifications` is an outbox first, transport second:

```
NotificationService.send({channels, recipient, title, body, metadata})
  → IN_APP record (status SENT)
  → EMAIL record    → SMTP adapter or outbox
  → SMS record      → Termii / Twilio adapter or outbox
  → WHATSAPP record → Twilio adapter or outbox
```

- `NOTIFICATIONS_MODE=outbox` stores every external message as `provider=outbox` with `status=SENT`; no network call is made. This is the default in local/Docker development.
- `NOTIFICATIONS_MODE=live` uses `EMAIL_PROVIDER=smtp`, `SMS_PROVIDER=termii|twilio` and Twilio WhatsApp credentials.
- Delivery attempts, provider message ids, last error and retry count are stored. The admin outbox can retry a failed external message.
- Email HTML escapes the title/body. WhatsApp/SMS bodies are plain text.
- The existing BullMQ `lims-notifications` worker wraps delivery in the tenant context. When queues are disabled, delivery runs inline.

## 3. Inventory and stain runs

`reagent_lots` tracks product, vendor/catalogue, lot, storage, quantity, expiry, validation and alert state. `stain_runs` snapshots the consumed lots and links to a case plus slide/block.

```
Receive lot → QUARANTINED / PENDING
Validate  → ACTIVE / VALIDATED   (expired lots cannot be validated)
Create run → check ACTIVE + VALIDATED + unexpired + quantity
           → deduct stock atomically + write snapshots
Complete run (QC PASS) → linked CUT slide becomes STAINED (custody event)
                       → FAIL/QC_HOLD leaves the slide un-stained
```

- The usable-lot check is inside the transaction. A stale UI cannot consume an expired or unvalidated lot.
- Expiry checks run daily through BullMQ maintenance. Active lots within 30 days produce an expiring alert; expired lots are moved to `EXPIRED` and produce an immediate alert.
- Stock adjustment is audited with before/after quantity.

## 4. Quality assurance

`qa_reviews` supports `PEER_REVIEW`, `SECOND_OPINION` and `DISCREPANCY`.

- On report sign-out, a random sample is selected using the laboratory's `qaSamplingPercent` (default 10%, seeded at 15%). The signer is excluded from reviewer selection when another pathologist exists.
- A review has a due date, original diagnosis, review diagnosis, findings, action plan and a coded discrepancy with severity.
- Discrepancy codes: major/minor diagnostic, grading, staging, biomarker/IHC, margin, lymph node, transcription, other.
- The assigned reviewer (or a lab admin) can start and close a review. Closing writes an audit entry and a notification.
- The QA page shows totals for pending, in review, agreed, discrepant and overdue.
- Specimen rejection codes are retained in the custody event and the specimen projection.

## 5. Offline-first scans

```
Scan station (browser)
  → API scan succeeds → result shown
  → network failure → IndexedDB mutation {id,type,payload}
  → pending badge in the shell
  → online → POST /sync/batch
              each mutation wrapped in IdempotencyService
              → first result: applied
              → replay: duplicate=true, original response returned
```

- The indexed queue is small and contains barcodes/stations only; patient data is not stored in IndexedDB.
- MLLP-style scan semantics are preserved: every accepted mutation is still a normal custody transaction on the server.
- The API exposes `Idempotency-Key` on `POST /custody/scan` and uses `sync-mutation` scope for batch items. A different request with the same key returns 409.
- The queue flushes on reconnect, on a 30-second interval while online, and via the visible badge.
- This phase queues scans/rejects/recuts. Draft grossing/stain-run offline authoring is intentionally Phase 4.
- The same `/sync/batch` endpoint can be deployed on-prem as the hospital's local sync target; the cloud and on-prem API use the same idempotency contract. No separate proprietary sync server is required.

## 6. FHIR R4

`GET /fhir/r4` is a bearer-authenticated read API using `application/fhir+json`:

| Resource         | Mapping                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Patient          | MRN identifier, name, sex, birth date, phone/address                                                                                   |
| ServiceRequest   | Case accession, priority, clinical history, referrer, specimen context                                                                 |
| Specimen         | Specimen barcode/label, type, site, received time, subject                                                                             |
| DiagnosticReport | Signed/amended report, status `final`/`corrected`, SNOMED conclusion, ICD-O-3 extensions, verification identifier, PDF `presentedForm` |

- `/metadata` is public and returns a CapabilityStatement; all patient resources require JWT and resolve inside the lab tenant.
- Search supports `_id`, `identifier`, `subject`, `status`, `date` and `_count`.
- The PDF `presentedForm` URL is built from `PUBLIC_API_URL`; the client must authenticate separately.

## 7. HL7 v2

- A plain TCP MLLP listener is enabled with `HL7_ENABLED=true` on `HL7_MLLP_PORT` (default 2575). It accepts ORM^O01/OML^O21 orders and returns ACK AA/AE.
- `HL7_LAB_CODE` selects the receiving laboratory; `HL7_ALLOWED_IPS` is an optional comma-separated allowlist.
- The parser reads MSH, PID, ORC, OBR, SPM and NTE segments. It maps patient demographics, priority, specimen type/site and clinical history into the same accession transaction used by the UI.
- `POST /interop/hl7/messages` is the authenticated HTTP path for testing/integration. `GET /interop/hl7/oru/:caseId` renders an ORU^R01 result from a signed report.
- MLLP is not encrypted and does not authenticate a sender. Put it behind a clinical VLAN, TLS terminator or integration engine.

## 8. Whole-slide imaging

- A slide can carry `wsiStatus`, `wsiUrl`, `wsiViewerUrl`, scanner, magnification and metadata.
- A pathologist/technologist can link a URL directly. The case slide row exposes a WSI action and a viewer link when present.
- Scanner integration posts to `/wsi/webhook` with `x-wsi-signature = HMAC-SHA256(JSON.stringify(body), WSI_WEBHOOK_SECRET)`. The body includes `labCode` and the slide barcode; the API resolves the tenant and slide then links it.
- The endpoint rejects a missing secret or invalid signature.

## 9. SNOMED CT and ICD-O-3

- `terminology_codes` holds the laboratory's licensed subset: system, code, display, category, synonyms.
- `GET /terminology/search` and admin `POST /terminology/import` manage it.
- Draft/amendment saves validate every supplied SNOMED/ICD-O-3 code and resolve the display from the local subset. Unknown codes are rejected.
- Report coding is shown in the synoptic editor, included in the PDF coding block, and mapped into FHIR DiagnosticReport `code` / `conclusionCode` / extensions.
- Do not redistribute proprietary code systems; load a licensed release.

## 10. Payments and HMO claims

```
Invoice (self/HMO/corporate) → ISSUED
  → Paystack/Flutterwave initialize → PENDING payment + checkout URL
  → provider webhook (signature verified) → SUCCESS payment
  → invoice amountPaid / balance → PAID or PARTIALLY_PAID
  → HMO claims CSV for a date range
```

- `PAYMENTS_MODE=mock` creates a local checkout page. `POST /payments/mock/:reference/complete` is available only in mock mode.
- Live Paystack and Flutterwave adapters call the provider APIs. Paystack uses HMAC-SHA512 of the raw body and `x-paystack-signature`; Flutterwave uses the `verif-hash` header.
- Webhook and mock payment lookups resolve the payment across tenants with a system-scoped lookup, then re-enter the owning lab before mutating. This preserves tenant isolation on a public callback.
- Manual cash/transfer/HMO receipts are transactional and audited.
- HMO invoices retain HMO name/code and authorization number; `GET /claims/export` returns CSV or JSON for a date range.

## 11. Security and test coverage

- Tenant plugin applies to all new collections. `portal_tokens`, `idempotency_keys`, inventory, QA, invoices, payments and terminology are lab-scoped.
- Audit actions now include RELEASE, PAYMENT, WEBHOOK, SYNC, QA, EXPORT, NOTIFY and IMPORT.
- The E2E suite covers 16 flows including portal magic-link verification, report release, lot validation blocking, stain-run completion, QA discrepancy, FHIR/WSI/HL7, mock payment + claims export and idempotent replay.
- Unit tests cover the custody state machine and report sign-out/amendment policy.
- Production hardening: disable `PORTAL_DEBUG`, `PAYMENTS_MODE=mock` and outbox-only mode; add TLS/rate limits; authenticate MLLP externally; use durable object storage; load licensed terminology.

## 12. Environment additions

See `.env.example` for the complete list. The Phase 2/3 block covers `PORTAL_*`, `NOTIFICATIONS_MODE`, SMTP/Termii/Twilio, `FHIR_ENABLED`, `HL7_*`, `WSI_WEBHOOK_SECRET`, `PAYMENTS_MODE`, Paystack/Flutterwave keys and `DEFAULT_CURRENCY`.
