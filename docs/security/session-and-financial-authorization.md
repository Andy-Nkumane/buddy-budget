# Session and financial authorization

## Enforcement boundaries

Buddy Budget is a static browser application. Supabase Auth owns password verification, PKCE,
access-token issuance, refresh-token rotation, session expiry, and refresh-session revocation. The
browser persists the Supabase session so an installed PWA can restore sign-in state; the tokens are
therefore readable by trusted same-origin JavaScript and would be exposed by a same-origin script
compromise. The application does not claim that browser storage can protect tokens from XSS.

React route guards improve navigation and require an authenticator challenge when an enrolled
account presents an AAL1 session. They are not the financial authorization boundary. PostgreSQL
grants, row-level security, household membership, role checks, and RPC validation remain
authoritative.

Migration `202610250001_enforce_mfa_for_household_data.sql` adds the shared
`session_meets_mfa_requirement()` database predicate and composes it into
`has_household_role(...)`. As a result:

- an account without a verified MFA factor may continue using an AAL1 session;
- an account with a verified factor must present an AAL2 JWT before household role checks succeed;
- an enrolled AAL1 session cannot read or mutate household financial tables through the Data API;
- existing household ownership, editor/viewer permissions, and cross-household isolation still
  apply after MFA succeeds.

The check uses the JWT assurance claim and the provider-owned verified-factor record. It does not
trust a browser flag. AAL2 does not make a stolen token harmless; it limits an enrolled account's
financial access when only its AAL1 session has been obtained.

## Browser and PWA handling

- `src/data/supabase/client.ts` uses PKCE, persisted sessions, automatic token refresh, and a global
  fetch wrapper that forces `cache: no-store`.
- `src/pwa/cachePolicy.ts` precaches static application assets only. It has no runtime cache and
  denies navigation fallback for Auth, REST, Edge Function, Storage, and export paths.
- TanStack Query data remains in memory and is not persisted. `AuthProvider` cancels queries,
  clears the query cache, and removes account-scoped transient state when the authenticated user
  changes or signs out.
- Household query keys contain both the user and active-household scope. Switching households
  cancels and removes the previous household scope before making the new context visible.

The public offline shell, install-prompt preference, and explicitly approved demo/calculator plan
are not deleted during account cleanup because they contain no authenticated financial history.
Supabase-managed Auth keys are removed by Supabase sign-out rather than by broad storage deletion.

GitHub Pages cannot set application-controlled HTTP response headers. The current meta CSP restricts
scripts, connections, forms, objects, and base URLs, but browsers do not enforce `frame-ancestors`
from a meta policy. Anti-framing, HSTS, `nosniff`, and the complete header policy therefore remain a
hosting limitation documented in `docs/security-checklist.md` and `docs/deployment.md`; moving to a
host or edge layer with configurable response headers is the supported remediation.

## Session expiry and revocation

The UI reacts to provider `SIGNED_OUT` events by clearing private in-memory and account-scoped
browser state. Global sign-out revokes refresh sessions, but an already issued access token can
remain valid until its configured JWT expiry. Immediate revocation for every ordinary request would
require a trusted online session lookup and is not implemented.

Staging and production must separately verify JWT expiry, refresh-token rotation and reuse
interval, inactivity/time-box settings, single-session policy, and global sign-out behavior in the
Supabase Dashboard. Repository configuration is not proof of hosted settings.

## Verification

`supabase/tests/0023_session_financial_authorization.test.sql` proves that an enrolled AAL1 session
cannot select or insert household financial data, the same session succeeds at AAL2, a
password-only account remains usable at AAL1, and cross-household isolation remains intact.
Existing pgTAP files cover table RLS, anonymous denial, forged ownership, household roles, adviser
scope, exports, restores, and destructive RPCs. Browser tests cover identity-change cache clearing,
household cache isolation, no-store requests, and PWA cache exclusions.

Use only disposable local or staging accounts when manually testing session expiry or revocation.
Never copy access tokens, refresh tokens, MFA secrets, financial payloads, or production user data
into test evidence.

## Rollback

Do not edit or remove the applied migration. If the provider emits assurance claims differently in
a deployed environment and access is blocked, first verify the hosted MFA configuration and JWT
claims with a disposable account. An owner-approved emergency rollback requires a new forward
migration restoring the previous `has_household_role(...)` body. That rollback weakens protection
for enrolled accounts and must be documented as an accepted risk; disabling RLS or broadening grants
is not an acceptable workaround.
