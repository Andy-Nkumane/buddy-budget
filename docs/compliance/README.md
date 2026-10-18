# South African compliance baseline

Audit date: 15 October 2026  
Branch: `audit/sa-compliance-baseline`  
Status: evidence baseline, not legal advice or a certification of compliance

## Purpose and scope

This folder records the repository-level compliance baseline for Buddy Budget. The review covered public and authenticated routes, authentication, Supabase access, migrations and row-level security (RLS), household/adviser sharing, exports and restores, account deletion, CSV import, PWA storage, dependencies, CI, and deployment documentation.

Buddy Budget is described as an experimental, non-commercial application for private development and authorised testing. That description does not waive legal duties or non-waivable rights. The code currently exposes registration and several public routes; whether a deployed instance is actually restricted to authorised testers depends on controls outside this repository and remains an owner decision.

## Documents

- [Data inventory](data-inventory.md)
- [Data-flow map](data-flow-map.md)
- [Data access, export, and correction](data-access-and-correction.md)
- [Legal applicability](legal-applicability.md)
- [Gap register](gap-register.md)
- [Owner decisions](owner-decisions.md)

## Audit method

Findings use these evidence levels:

- **CONFIRMED**: directly demonstrated by repository content.
- **LIKELY**: supported by the implementation but dependent on deployment or operating facts.
- **POSSIBLE**: requires owner, legal, provider, or production-environment verification.

Severity is a remediation priority, not a legal conclusion: P0 is release-blocking; P1 is high; P2 is medium; P3 is low. Stable gap IDs must not be renumbered when a gap closes. Update its status and add closure evidence instead.

## Executive findings

1. **CONFIRMED:** the browser application supports unrestricted account registration at `/auth/register`; `/demo`, `/calculator`, `/shared-report`, and `/template` are unauthenticated routes (`src/app/routing/AppRouter.tsx`, `src/features/auth/RegisterPage.tsx`). No repository-controlled tester allowlist is present. See `COMP-001`.
2. **CONFIRMED:** the system processes identity, household relationship, detailed financial, goal, schedule, notification, access-log, and authentication data. Supabase and Mailjet are identifiable recipients/operators; GitHub Pages hosts the static client. See the inventory and `COMP-002` to `COMP-005`.
3. **CONFIRMED:** database ownership controls are substantial: RLS is enabled across domain tables, authenticated operations are scoped, cross-owner foreign keys exist, privileged functions set an empty search path, and dedicated pgTAP tests cover many policies (`supabase/migrations`, `supabase/tests`). These controls reduce but do not establish legal compliance.
4. **CONFIRMED:** CSV files are parsed in the browser and raw files are not deliberately uploaded; accepted structured transaction records are written to Supabase (`src/features/transactions/import`). Demo data stays in memory, while approved onboarding handoffs and authentication sessions use browser storage.
5. **CONFIRMED:** portable JSON export/restore, correction controls, account deletion, and interim rights guidance exist. The repository does not define a complete retention schedule, backup erasure procedure, verified rights-request operation, or operator-contract register. See `COMP-003`, `COMP-006`, and `COMP-007`.
6. **CONFIRMED:** public report/template sharing uses opaque tokens, stores hashes, supports expiry/revocation, and returns no-store responses. Shared snapshots can nevertheless contain financial data by explicit user selection and are handled by a service-role Edge Function (`supabase/functions/share-report/index.ts`). See `COMP-008`.
7. **LIKELY:** POPIA is the principal mandatory framework if the operator determines the purposes and means of processing South African users' personal information. PAIA obligations are also relevant to the responsible private body, subject to current exemptions and legal review.
8. **POSSIBLE/conditional:** CPA and ECTA obligations increase if the service is publicly supplied, marketed, or commercialised. FAIS, FICA, and NCA are not triggered by budgeting calculations alone on the reviewed facts, but must be reassessed before personalised product advice, intermediation, account aggregation/payment activity, credit provision, or debt counselling is introduced.

## Existing controls worth preserving

- Supabase PKCE authentication and browser-safe publishable key validation (`src/data/supabase/client.ts`).
- RLS, ownership-aware foreign keys, role separation, immutable history controls, and policy tests (`supabase/migrations`, `supabase/tests`).
- Query-cache clearing when identity or household changes (`src/app/providers/AuthProvider.tsx`, `src/app/providers/HouseholdProvider.tsx`).
- Client-side CSV parsing and bounded imports (`src/features/transactions/import`).
- Hashed, expiring, revocable public-share tokens and privacy-minimised report defaults (`supabase/functions/share-report`, `src/features/reports`).
- Mailjet secrets read only by the weekly-check-in Edge Function (`supabase/functions/weekly-checkin/index.ts`).
- User export, restore, and account-deletion workflows (`src/features/settings`, `supabase/migrations`).
- No third-party analytics identified in source or dependencies (`package.json`, `docs/interactive-demo-privacy.md`).

## Review and maintenance

The owner should review the gap register before any deployment or invitation of testers. Re-run this baseline after material changes to authentication, recipients, telemetry, public sharing, financial recommendations, payments, credit, or deployment region. A South African privacy/legal professional should validate the legal conclusions and required notices before public release.
