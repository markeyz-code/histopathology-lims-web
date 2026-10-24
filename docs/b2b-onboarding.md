# B2B onboarding — hospitals and standalone laboratories

The platform supports two commercial shapes without changing the tenancy model:

- **Hospital groups** — one organization owns one or more laboratories. Every laboratory is still an isolated tenant with its own `labId`, staff, disciplines, catalogue, cases, custody and audit.
- **Standalone laboratories** — an organization owns a single laboratory.

## Roles

- **Super administrator** (`SUPER_ADMIN`) — platform vendor. Sees the Platform section, all organizations and all laboratories, and performs onboarding/suspension.
- **Laboratory administrator** (`LAB_ADMIN`) — belongs to one laboratory. Lands in `/admin` after accepting an invitation and configures that tenant only.
- Super administrators do not silently share a laboratory's data; cross-tenant queries run explicitly under the system tenant with audit metadata.

## Onboarding wizard

`/super-admin` → **Onboard organization** collects:

1. Organization: name, unique code, type (hospital/standalone), plan, country/state/city, contact.
2. First laboratory: name, unique code, accession prefix, currency, enabled disciplines.
3. First administrator: name and work email.

The server then, in one MongoDB transaction:

- creates the `organizations` document in `ONBOARDING` status;
- creates the `labs` document with `organizationId`, disciplines, prefix and letterhead defaults;
- creates the `LAB_ADMIN` user with `mustChangePassword`, a hashed one-time invitation token and expiry;
- provisions a starter catalogue (FBC and chemistry tests, filtered to enabled disciplines);
- writes an audit entry;
- queues an email/in-app invitation.

The super administrator receives a one-time invitation link. The administrator opens `/portal/accept-invite`, sets a password, and is signed into the laboratory's `/admin` configuration area. Accepting the invitation activates the organization.

## Laboratory administration

Every laboratory has `/admin`:

- setup checklist (profile, disciplines, catalogue, team, rules, integrations);
- staff and roles (`/admin/users`);
- test catalogue (`/admin/catalog`);
- rules (`/admin/rules`);
- synoptic protocols (`/admin/protocols`);
- lab settings, letterhead, TAT, accession format (`/admin/settings`);
- billing, inventory, integrations, audit and message outbox.

## Platform administration

`/super-admin` and `/super-admin/organizations/:id` provide:

- platform counts (organizations, laboratories, users, cases, trials ending);
- organization list and detail with laboratories, users and cases;
- add a laboratory to an existing organization;
- invite additional laboratory administrators;
- suspend/restore a laboratory or suspend/activate an organization;
- manual assignment of legacy laboratories to an organization.

## API

```
POST /api/super-admin/onboard
GET  /api/super-admin/overview
GET/POST /api/super-admin/organizations
GET/PATCH /api/super-admin/organizations/:id
POST /api/super-admin/organizations/:id/labs
POST /api/super-admin/labs/:id/invite-admin
PATCH /api/super-admin/labs/:id/organization
PATCH /api/super-admin/labs/:id/status
POST /api/auth/accept-invite
```

All platform endpoints are `SUPER_ADMIN`-only. Invitations are single-use, hashed at rest, expire after seven days, and the administrator must set their own password.

## Demo

- Super administrator: `superadmin@histo.ng` / `SuperAdmin#2026` at `/super-admin`
- Laboratory administrator: `admin@histo.ng` / `LabAdmin#2026` at `/admin`
- Seeded organization: **Lagos Central Health Group**, hospital type, Enterprise plan, linked to the demo laboratory.

## Tests

The E2E suite includes onboarding a new hospital laboratory, accepting the invitation, signing in with the new tenant, and reading its provisioned catalogue.
