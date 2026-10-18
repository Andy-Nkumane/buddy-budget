# Compliance regression suite

This suite turns repository-verifiable compliance controls into repeatable tests. It does not certify legal compliance or prove hosted configuration. Database and authenticated browser tests must use local or disposable test identities, never production accounts.

## Automated evidence map

| Gap IDs                | Control                                                                          | Automated evidence                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COMP-001`, `COMP-002` | Tester admission, collection notice, acknowledgement, and public legal routes    | `RegisterPage.test.tsx`, `LegalPages.test.tsx`, `PrivacyPolicyPage.test.tsx`, `registration-transparency.spec.ts`, `legal-navigation.spec.ts`, `privacy-policy.spec.ts`, `0019_tester_signup_allowlist.test.sql` |
| `COMP-006`             | Export visibility and correction permissions                                     | `ExportDataForm.test.tsx`, `0020_data_access_and_correction.test.sql`                                                                                                                                            |
| `COMP-007`             | Authorised deletion, failure reporting, relational cleanup, and session cleanup  | `AccountDeletion.test.tsx`, `AuthProvider.test.tsx`, `0021_account_deletion_retention.test.sql`                                                                                                                  |
| `COMP-021`, `COMP-022` | Table/function privilege boundaries, RLS, forged ownership, and anonymous access | `0018_security_isolation.test.sql` and the feature-specific pgTAP suites                                                                                                                                         |
| `COMP-023`             | No-store requests, private cache exclusions, and scoped browser cleanup          | `noStoreFetch.test.ts`, `cachePolicy.test.ts`, `accountSession.test.ts`                                                                                                                                          |
| `COMP-017`             | No tracked environment files or server credential variable names in browser code | `check-compliance-boundaries.test.mjs`, `npm run test:compliance`, and CI gitleaks history scanning                                                                                                              |

The gap ID in each focused test title makes failures traceable to the register without duplicating the underlying test logic.

## Commands

Run from WSL at the repository root:

```bash
npm ci
npm run test:compliance
npm test
npm run test:e2e:compliance
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
npm run test:db
npx supabase stop --no-backup
```

The Playwright command exercises public routes without an account. Its authenticated Settings assertions run only when `E2E_EMAIL` and `E2E_PASSWORD` identify a dedicated disposable test user. Never supply production credentials. The pgTAP tests create deterministic local fixtures inside transactions and roll them back.

## CI boundaries

The web job runs formatting, linting, type checks, Vitest, the local compliance boundary gate, dependency audit, build, public Playwright checks, and gitleaks. The database job starts an isolated local Supabase stack and runs pgTAP. Authenticated Playwright cases remain an explicit pre-merge check because they require a disposable account; skipped authenticated checks are not evidence that those flows passed.

## Manual and owner-dependent checks

Automation cannot establish the following. Record dated evidence and the reviewer in the relevant compliance document or gap before release:

- verify production Supabase Auth hooks, redirect URLs, grants, RLS, selected region, backups, restore testing, log access, and Edge secrets;
- verify GitHub Pages/CDN response headers and that the deployed instance is restricted to authorised testers;
- approve the responsible-party identity, privacy/terms effective dates, rights-request channel, Information Officer registration, PAIA manual position, and retention decisions;
- verify Supabase, GitHub, and Mailjet account terms, regions, subprocessors, transfer grounds, deletion support, and incident contacts;
- exercise account deletion and access/export with disposable staging users, including provider and backup limitations;
- inspect browser Cache Storage, storage cleanup, offline public shell, and authenticated API responses in a production-like build;
- run and document the incident tabletop and notification decision exercise.

For every manual check, retain the environment, timestamp, reviewer, exact observation, sanitized evidence location, outcome, and linked gap ID. Do not place tokens, credentials, production user data, or financial payloads in screenshots, logs, or issue comments.
