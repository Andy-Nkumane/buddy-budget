# Data-flow map

## Trust boundaries

```text
Visitor browser
  ├─ public demo/calculator (memory and approved browser handoff)
  ├─ GitHub Pages/static hosting (HTML, JS, CSS, PWA assets)
  └─ public share token → Supabase Edge Function → restricted snapshot RPC

Authenticated browser
  ├─ Supabase Auth (email/password, PKCE session)
  ├─ Supabase Data API/RPC → PostgreSQL + RLS
  ├─ weekly-check-in Edge Function → Mailjet (only when opted in/tested)
  └─ local downloads/uploads (JSON, CSV, PDF)

Authorised operations
  ├─ GitHub Actions → build/test/deploy static application
  ├─ Supabase secrets → Edge Functions/service role
  └─ project owner → database, backups, logs and provider dashboards
```

## Flow register

| ID    | Flow                          | Data                                                                             | Transfer/recipient                                                               | Controls observed                                                                                            | Open issue                                                                                       |
| ----- | ----------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| DF-01 | Registration/sign-in/recovery | Email, password credential, acknowledgement metadata, session metadata           | Browser ↔ Supabase Auth; verification email infrastructure                       | Notice; unchecked acknowledgement; PKCE; allowlist Auth hook; session isolation                              | Hosted hook, tester approval and email-provider configuration unverified                         |
| DF-02 | Authenticated budgeting       | Profile, household, plans, transactions, notes, goals and schedules              | Browser ↔ Supabase Data API/PostgreSQL                                           | RLS, ownership FKs, household roles, validation, exact money representations in newer features               | Production policy deployment and penetration/security review unverified                          |
| DF-03 | CSV import                    | Raw statement rows then selected structured transactions                         | Local file → browser; accepted records → Supabase                                | Local parsing, preview, row limits, duplicate fingerprints                                                   | User notice for third-party/payee data and retention absent                                      |
| DF-04 | Export/PDF                    | Selected/full domain records                                                     | Supabase → browser → user-selected device location                               | User action; versioned JSON; exclusions documented                                                           | Device-side protection is user-dependent; rights-response procedure absent                       |
| DF-05 | Restore                       | Local backup file and mapped domain records                                      | Device → browser validation → transactional Supabase RPC                         | Schema validation, hostile fixtures, idempotency, ownership remapping, confirmation                          | Recovery snapshot retention and operational rollback policy undefined                            |
| DF-06 | Account deletion              | Account and related user/household records                                       | Browser → protected RPC → PostgreSQL/Auth                                        | Recent authenticated session, transactional deletion machinery, cascades                                     | Backups, provider logs, sole-owner/recipient handling need verified procedure                    |
| DF-07 | Weekly check-in               | Email, preferences, privacy mode, generated budget summary                       | PostgreSQL → Edge Function → Mailjet → recipient                                 | Explicit opt-in, test flow, server-only credentials, idempotency and retry bounds                            | Operator agreement, transfer location, retention, unsubscribe/bounce operations unverified       |
| DF-08 | Public report                 | User-selected immutable financial snapshot                                       | Browser → Edge Function/PostgreSQL; token holder → Edge Function                 | Aggregate/redacted defaults, hashed token/code, expiry, revocation, view limit, no-store/no-referrer headers | Snapshot purge and accidental third-party disclosure response undefined                          |
| DF-09 | Public template               | Template structure and optional amounts                                          | Browser → Edge Function/PostgreSQL; anonymous/authenticated recipient            | Amounts opt-in, hashed token, expiry/revocation, rate limiting, ownership remap                              | IP-derived visitor hash disclosure/retention and purge undefined                                 |
| DF-10 | Household invitation          | Recipient email, role, opaque invitation token                                   | Member → Supabase; link copied/sent by member                                    | Expiring, single-use, verified-recipient checks                                                              | Delivery channel is outside application control; notice to invitee absent                        |
| DF-11 | Adviser grant                 | Adviser email/identity, scope, date range, financial report sections, access log | Owner → Supabase → verified adviser                                              | Own account required, explicit scope/expiry, database-enforced read-only access, revocation                  | Professional role does not itself prove lawful authority; owner guidance/legal basis needed      |
| DF-12 | Demo/calculator conversion    | Explicitly approved plan/template only                                           | Public browser storage → onboarding → Supabase after authentication/confirmation | No Supabase calls before conversion, expiry/one-time consumption, transactions excluded                      | Browser storage disclosure and shared-device guidance need public notice                         |
| DF-13 | PWA                           | Static app shell/assets; Supabase Auth uses its own browser persistence          | Hosting → service-worker cache; Auth → browser storage                           | No authenticated financial runtime caching configured; cache cleanup enabled                                 | Browser session/storage risk on shared devices requires user guidance                            |
| DF-14 | CI/deployment                 | Source, build artifacts, public Vite variables                                   | GitHub Actions/Pages and Supabase deployment tooling                             | CI quality checks; browser variables limited to project URL/publishable key                                  | Environment protection, approvers, secret rotation and production access need owner verification |

## Cross-border and operator questions

Supabase, GitHub and Mailjet may process data outside South Africa depending on selected regions and contractual arrangements. The repository does not establish regions, subprocessor locations, contracts, transfer safeguards or responsible-party identity. These facts must be completed before a transfer-lawfulness conclusion (`COMP-004`, `OD-003`, `OD-004`).

## Data-subject rights path

Self-service export, correction through application forms, locked-history adjustments, account deletion, and interim request routing are documented in `data-access-and-correction.md`. They remain an incomplete POPIA/PAIA procedure until the owner approves identity verification, monitored intake, response ownership, statutory timing, exceptions, backup/log handling, objection/restriction, complaint escalation, and request records (`COMP-006`).
