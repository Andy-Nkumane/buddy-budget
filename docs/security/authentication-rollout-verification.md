# Authentication rollout verification

Review date: 26 October 2026  
Scope: Phases 01–09 as merged into `security/10-rollout-verification`  
Decision scope: private authorised testing only  
Production configuration evidence: not available to this repository review

## Decision

The application code is ready for a staged private-test deployment, but the deployment is
**CONFIGURATION REQUIRED** until every release gate below has redacted evidence from the target
Supabase and GitHub environments. This is not approval for public access or commercial use.

`IMPLEMENTED` means the repository contains the control and relevant automated evidence.
`CONFIGURATION REQUIRED` means an owner must configure or verify a hosted control. `BLOCKED` means
the current architecture cannot provide the control. `NOT APPLICABLE` means the control was
deliberately excluded and must not be represented as available.

## Requirement verification matrix

| Requirement                                                                      | Status                 | Enforcement location                                                                       | Test or review evidence                                                                             | Residual risk                                                                                             | Owner                           |
| -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Authorization Code with PKCE and exact, base-aware Auth URLs                     | IMPLEMENTED            | `src/data/supabase/client.ts`, `src/features/auth/authUrls.ts`, callback and reset routes  | Auth URL, callback, and reset component tests                                                       | Hosted URL allowlist can still be broader than the application-generated URLs                             | Application owner               |
| Exact production site URL and redirect allowlist                                 | CONFIGURATION REQUIRED | Supabase Auth URL Configuration                                                            | Follow the Dashboard checklist in the Phase 01 audit using disposable staging identities            | Repository evidence cannot inspect the hosted allowlist                                                   | Supabase project owner          |
| Server-side authorised-tester admission                                          | IMPLEMENTED            | Migration `202610170001_add_tester_signup_allowlist.sql`                                   | pgTAP `0019_tester_signup_allowlist.test.sql`                                                       | The control has no effect unless the hosted Auth hook is enabled                                          | Database owner                  |
| Before-user-created hook enabled in each hosted project                          | CONFIGURATION REQUIRED | Supabase Auth Hooks                                                                        | Prove one disposable allowed signup succeeds and one absent/expired signup fails                    | An unconfigured project may allow public registration                                                     | Supabase project owner          |
| Email confirmation and reviewed email/password providers                         | CONFIGURATION REQUIRED | Supabase Auth Providers                                                                    | Record redacted Dashboard state and test a disposable unverified account                            | Local confirmation is intentionally disabled; hosted state is unknown                                     | Supabase project owner          |
| New/reset password length policy: 15 Unicode code points, maximum 72 UTF-8 bytes | IMPLEMENTED            | `src/shared/validation/schemas.ts`, registration, reset, and change-password forms         | Schema, registration, reset, and change-password tests                                              | Provider minimum is byte-based and cannot exactly enforce the client code-point rule                      | Application owner               |
| Legacy-compatible password sign-in                                               | IMPLEMENTED            | Sign-in schema and `SignInPage`                                                            | Sign-in component tests                                                                             | Provider remains the authoritative verifier                                                               | Application owner               |
| Hosted minimum password length aligned with the client policy                    | CONFIGURATION REQUIRED | Supabase Auth password settings                                                            | Verify the setting and boundary cases in staging                                                    | Direct Auth calls bypass browser validation if hosted policy is weaker                                    | Supabase project owner          |
| Known-breached-password rejection and safe guidance                              | CONFIGURATION REQUIRED | Hosted Supabase leaked-password protection; safe mapping in `authErrors.ts` is IMPLEMENTED | `authErrors.test.ts`, registration tests, and `breached-password-protection.md` staging procedure   | Provider screening availability and production state are unknown                                          | Supabase project owner          |
| Generic authentication errors and recovery anti-enumeration copy                 | IMPLEMENTED            | `authErrors.ts` and Auth pages                                                             | Sign-in, registration, forgot-password, callback, and reset tests reject provider diagnostics       | Timing remains provider/network dependent                                                                 | Application owner               |
| Auth rate-limit response handling                                                | IMPLEMENTED            | `authErrors.ts` and Auth pages                                                             | `authErrors.test.ts`, `SignInPage.test.tsx`, `ForgotPasswordPage.test.tsx`                          | The client does not set provider limits                                                                   | Application owner               |
| Hosted Auth rate limits and abuse monitoring                                     | CONFIGURATION REQUIRED | Supabase Auth rate limits and logs                                                         | Execute the bounded staging checks in `auth-abuse-protection.md`                                    | Unknown limits or absent alerts can delay abuse detection                                                 | Security operations owner       |
| CAPTCHA for public Auth endpoints                                                | CONFIGURATION REQUIRED | Supabase Auth plus a reviewed client integration                                           | Record an explicit enable/defer decision; test accessibility and failure behavior before enablement | No CAPTCHA integration exists; UI-only throttling would be bypassable                                     | Product and security owners     |
| TOTP enrollment, verification, challenge, factor removal, and accessible errors  | IMPLEMENTED            | `mfa.ts`, `MfaSettings.tsx`, `MfaChallengePage.tsx`, route guards                          | MFA provider, settings, challenge, and route-guard tests                                            | TOTP is phishable; factor-loss support remains operational                                                | Application owner               |
| Hosted TOTP settings and disposable end-to-end validation                        | CONFIGURATION REQUIRED | Supabase Auth MFA settings                                                                 | Complete the staging procedure in `mfa.md` without retaining QR codes or secrets                    | Repository config proves local behavior only                                                              | Supabase project owner          |
| AAL2 for enrolled users accessing household or adviser financial data            | IMPLEMENTED            | Migrations `202610250001` and `202610250002`                                               | pgTAP `0023_session_financial_authorization.test.sql`                                               | Password-only accounts intentionally remain at AAL1                                                       | Database owner                  |
| Recent password authentication and AAL2 when enrolled for account deletion       | IMPLEMENTED            | Migrations `202610200001` and `202610240001`; deletion UI                                  | pgTAP `0021` and `0022`; account-deletion component tests                                           | Staging must validate the complete password-plus-TOTP flow                                                | Database and application owners |
| Recovery-link-only password reset, code removal, and global session revocation   | IMPLEMENTED            | `ResetPasswordPage.tsx` and Auth provider boundary                                         | `ResetPasswordPage.test.tsx` and `account-recovery.md`                                              | Email-account takeover can still authorize recovery                                                       | Application owner               |
| In-app password change with current password and global sign-out                 | IMPLEMENTED            | `ChangePasswordForm.tsx`                                                                   | `ChangePasswordForm.test.tsx`                                                                       | Hosted secure-password-change and notification settings are unknown                                       | Application owner               |
| Secure password change, reset expiry/replay, and notification email behavior     | CONFIGURATION REQUIRED | Supabase Auth password and email settings                                                  | Run disposable staging reset/replay/session tests                                                   | Hosted behavior cannot be proven from local config                                                        | Supabase project owner          |
| Password-manager and autofill-compatible fields                                  | IMPLEMENTED            | Shared `PasswordField` and Auth/settings forms                                             | `PasswordField.test.tsx` and Auth form tests                                                        | Password-manager behavior varies; complete the documented manual browser check                            | Application owner               |
| Persistent SPA sessions with account/cache isolation                             | IMPLEMENTED            | Supabase client, `AuthProvider`, `HouseholdProvider`, transient-state cleanup              | Provider, route, cache, and compliance-boundary tests                                               | Same-origin script or device compromise can read browser-held sessions                                    | Application owner               |
| Session lifetime, inactivity timeout, and single-session policy                  | CONFIGURATION REQUIRED | Supabase Auth Sessions                                                                     | Record approved values and test multi-browser behavior in staging                                   | Local one-hour JWT expiry does not prove hosted settings                                                  | Supabase project owner          |
| RLS, household isolation, adviser scope, function grants, and safe definer paths | IMPLEMENTED            | PostgreSQL policies, constraints, and RPCs                                                 | pgTAP suite including `0018_security_isolation.test.sql` and `0023`                                 | Production migration/catalog drift remains possible                                                       | Database owner                  |
| Private Auth/API responses excluded from service-worker runtime caches           | IMPLEMENTED            | `src/pwa/cachePolicy.ts`, `src/pwa/noStoreFetch.ts`                                        | PWA/cache policy and compliance-boundary tests                                                      | Browser and provider infrastructure remain outside the service-worker policy                              | Application owner               |
| Secrets absent from browser code; CI secret and dependency gates                 | IMPLEMENTED            | Vite env boundary and `.github/workflows/quality.yml`                                      | gitleaks, scanner fixture test, dependency review, npm audit, and compliance checks                 | CI cannot detect secrets stored only in external systems                                                  | Repository owner                |
| Immutable SHA pins for third-party CI actions                                    | IMPLEMENTED            | `.github/workflows/quality.yml`                                                            | Workflow review and CI execution                                                                    | Owners must review future pin updates                                                                     | Repository owner                |
| Production migrations through `202610250002` applied in order                    | CONFIGURATION REQUIRED | Supabase migration history                                                                 | Compare target history to the repository; do not edit applied migrations                            | Missing or drifted migrations can weaken authorization                                                    | Database owner                  |
| SMTP identity, SPF/DKIM/DMARC, and Auth email delivery                           | CONFIGURATION REQUIRED | Supabase custom SMTP and DNS provider                                                      | Redacted provider evidence and disposable staging delivery tests                                    | Recovery availability and anti-phishing trust depend on correct configuration                             | Email and Supabase owners       |
| Central Auth monitoring and actionable alerts                                    | CONFIGURATION REQUIRED | Supabase/GitHub logs and an owner-approved alert destination                               | Run the alert checks in `authentication-operations-runbook.md`                                      | No repository evidence proves alert delivery or log retention                                             | Security operations owner       |
| Recovery codes issued by Buddy Budget                                            | NOT APPLICABLE         | None                                                                                       | `mfa.md` explicitly states that recovery codes are not issued                                       | Users who lose every factor require the approved assisted-recovery process                                | Product owner                   |
| Application-set HTTP security headers on GitHub Pages                            | BLOCKED                | GitHub Pages hosting boundary                                                              | Verify the deployed response headers before launch                                                  | Static markup cannot enforce HSTS, `frame-ancestors`, or `nosniff`; use a header-capable host if required | Deployment owner                |

## Existing finding disposition

| Finding  | Disposition            | Explanation                                                                                                                                                |
| -------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-001 | CONFIGURATION REQUIRED | The hook and tests are implemented; hosted enablement remains a release gate.                                                                              |
| AUTH-002 | CONFIGURATION REQUIRED | TOTP and AAL enforcement are implemented; hosted verification and factor-loss ownership remain.                                                            |
| AUTH-003 | CONFIGURATION REQUIRED | Client/local policy is implemented; hosted alignment remains.                                                                                              |
| AUTH-004 | IMPLEMENTED            | Recent password authentication and conditional AAL2 are enforced by PostgreSQL.                                                                            |
| AUTH-005 | IMPLEMENTED            | The accepted SPA session model is hardened by CSP, cache isolation, RLS, MFA, and CI controls; browser-readable storage remains an inherent residual risk. |
| AUTH-006 | CONFIGURATION REQUIRED | Safe UX exists; hosted rate limits, breached-password protection, CAPTCHA decision, and monitoring require owner evidence.                                 |
| AUTH-007 | CONFIGURATION REQUIRED | Recovery and in-app change flows are corrected; hosted email/security behavior still needs staging proof.                                                  |
| AUTH-008 | CONFIGURATION REQUIRED | URL construction is implemented; hosted allowlists need evidence.                                                                                          |
| AUTH-009 | CONFIGURATION REQUIRED | Global sign-out and cache clearing are implemented; session-policy values and multi-browser behavior need approval and proof.                              |
| AUTH-010 | IMPLEMENTED            | Stable privacy-safe messages replace provider diagnostics.                                                                                                 |
| AUTH-011 | IMPLEMENTED            | Actions are SHA-pinned and dependency/secret checks are required by the quality gate.                                                                      |
| AUTH-012 | CONFIGURATION REQUIRED | Deterministic unit and pgTAP coverage exists; hosted email, callback replay, and multi-session flows need disposable-browser evidence.                     |
| AUTH-013 | IMPLEMENTED            | Vite is patched and the high-severity audit gate is retained.                                                                                              |

## Release gates

Do not promote a deployment until the environment owner records the project reference, reviewer,
date, result, and a private redacted evidence location for each applicable item. Never place tokens,
passwords, tester addresses, MFA secrets, or recovery links in the evidence.

- Hosted tester hook enabled and a disposable allow/deny test passed.
- Email confirmation, intended providers, exact site URL, and exact redirect URLs verified.
- Hosted password length, breached-password protection availability, secure password change, and
  password notification settings verified.
- Rate limits recorded; CAPTCHA has an explicit approved decision rather than an assumed default.
- TOTP enabled and enrollment, challenge, lost-factor escalation, and deletion tested in staging.
- Session/JWT settings recorded and global sign-out tested across two disposable browser profiles.
- Migration history through `202610250002` reconciled and the complete pgTAP suite passed against
  disposable staging or an equivalent restored schema.
- SMTP identity and recovery/verification delivery tested with disposable addresses.
- Auth, database, CI, and incident alert owners acknowledged the operations runbook.
- No unresolved P0/P1 result exists in CI, the database linter, or the release evidence.

## Staged deployment and rollback

### Stage 0 — ownership and evidence

Assign the application, database, Supabase, email, repository, support, and incident owners. Record
the current hosted settings before changing them. Back up database configuration through the
approved recovery process and verify that no evidence contains personal or secret data.

### Stage 1 — disposable staging

Apply repository migrations in order without editing an applied migration. Configure the exact
staging URLs, tester hook, email, password, session, rate-limit, and TOTP settings. Run unit,
compliance, build, pgTAP, and secret gates, followed by bounded disposable-user flows for signup,
login, reset, password change, MFA, account deletion, logout, and cross-user denial.

### Stage 2 — existing-user rehearsal

- Do not force-reset existing password hashes. The stronger rule applies when a password is created
  or changed; legacy credentials must still reach the provider at sign-in.
- MFA remains opt-in. An account with a verified factor must reach AAL2 before financial access;
  an account with no verified factor remains supported at AAL1.
- Ask users to enroll a second authenticator before replacing a device. Buddy Budget does not issue
  recovery codes; publish the assisted-recovery contact and escalation owner before rollout.
- Confirm existing household roles, adviser grants, onboarding state, and financial records remain
  unchanged after migrations. Use synthetic or disposable staging records only.

### Stage 3 — private-test canary

Deploy to a small authorised-tester cohort. Observe aggregate Auth failures, hook failures, email
delivery, MFA challenges, recovery, and authorization denials without logging credentials, tokens,
codes, email contents, or financial payloads. Stop expansion if a user is locked out without the
approved recovery path or if any isolation test fails.

### Stage 4 — private authorised testing

Promote the same reviewed artifact and configuration. Re-run a disposable allow/deny signup,
recovery, MFA, and cross-account smoke test. Record the artifact revision and configuration review,
then monitor the signals in the operations runbook.

### Rollback

Prefer configuration rollback or application artifact rollback only when it does not weaken a
database authorization boundary. Never edit or remove an applied migration, disable RLS, broaden a
grant, expose a privileged key, or bypass the tester hook as a shortcut. A necessary database
rollback must be a new, owner-approved forward migration with a documented security exception and
the pgTAP suite rerun. If MFA causes lockout, pause new enrollment and use the verified recovery
process; do not remove AAL enforcement globally until the affected factor/configuration is
diagnosed. Restore hosted settings from the recorded pre-change values one control at a time and
repeat the affected staging test before promotion.

## Verification boundaries

This review verifies repository state, local configuration, and automated test intent. It does not
prove production migration history, Supabase Dashboard settings, SMTP/DNS state, administrator MFA,
log retention, alert delivery, or the deployed HTTP headers. Those remain owner-provided release
evidence. The original threat audit remains a historical baseline; this matrix is its current
implementation disposition.
