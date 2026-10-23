# Breached-password protection

Reviewed: 23 October 2026  
Scope: registration and password reset  
Status: provider configuration required on Supabase Pro or above; blocked on Free

## Decision

Buddy Budget uses Supabase Auth's built-in leaked-password protection as the intended trusted
control. Supabase checks newly supplied passwords against the Have I Been Pwned Pwned Passwords
service and returns a `weak_password` error when a password is known to be compromised.

The application maps that provider rejection to concise guidance without displaying raw provider
errors. It does not perform password screening in the browser and does not send passwords or
password-derived prefixes to any service itself.

This repository cannot enable or prove the hosted setting. Supabase documents leaked-password
protection as a Pro Plan or higher feature. Therefore:

- **CONFIGURATION REQUIRED** when the deployed project is on Pro or above;
- **BLOCKED** when the deployed project is on Free;
- **UNVERIFIED** until redacted Dashboard evidence and a disposable staging test exist.

No database migration or browser secret is required.

## Why a custom checker was not added

A browser-side Have I Been Pwned request would be bypassable and would make the browser responsible
for handling password-derived material. A separate Edge Function would still be bypassable through
direct calls to Supabase Auth unless every password-creation path were replaced by a custom trusted
authentication service. That would add a second authentication boundary and is not justified while
Supabase provides native enforcement.

The before-user-created hook is not an alternative because its payload does not include the
plaintext password. The password-verification hook applies to sign-in rather than new-password
creation.

## Provider behavior and outage policy

The open-source Supabase Auth implementation calls its HIBP client while checking password
strength. It can either fail closed when the lookup fails or log a warning and allow the password
when fail-closed behavior is disabled. The hosted Dashboard does not provide repository-verifiable
evidence of which outage behavior is used for this project.

The deployment owner must confirm the hosted behavior with current Supabase documentation or
support. Buddy Budget must not add a browser fallback during an outage. If the provider fails the
request, the application shows the normal safe password-reset or registration failure and allows a
later retry. If the provider fails open, that residual risk is provider-controlled and must be
recorded rather than hidden.

Passwords, password hashes, HIBP query material, and provider error payloads must not be written to
application logs, analytics, screenshots, or repository evidence.

## Existing accounts

Enabling the provider feature does not rewrite stored password hashes or automatically rotate
existing credentials. Supabase documents that existing users can continue signing in, with weak
password information potentially returned by `signInWithPassword`. Buddy Budget does not force an
unannounced reset in this phase. Any future forced-rotation policy needs a separate recovery and
support review.

## Hosted configuration and verification

For staging and production separately:

1. Record the Supabase project, environment, plan, reviewer, and review date without recording
   credentials or user email addresses.
2. If the project is below Pro, record the control as **BLOCKED** and decide whether to upgrade.
3. On Pro or above, open the project's Authentication password security settings and enable leaked
   password protection.
4. Capture redacted evidence showing the setting and environment. Do not include tokens, project
   secrets, password values, or tester identities.
5. In staging only, use a disposable authorised account and a provider-approved test procedure to
   verify:
   - a password reported as leaked is rejected during signup;
   - a safe generated password is accepted;
   - a leaked password is rejected during recovery password update;
   - direct Auth API submission cannot bypass the control;
   - provider-unavailable behavior matches the approved outage decision.
6. Delete the disposable account and retain only non-sensitive PASS/FAIL evidence.

Do not intentionally submit real user passwords, copied breach credentials, or production accounts.
Do not disrupt the provider or simulate an outage against production.

## Test coverage and limitations

Repository tests verify successful registration, provider `weak_password` mapping, generic outage
handling, raw-error redaction, and the production/local duplicate-account distinction. They do not
prove that hosted Supabase has enabled HIBP screening. A provider-backed breached/safe/outage/direct
API test is **NOT RUN** until a Pro-or-higher disposable staging project is available.

## Rollback

Disabling the hosted control weakens password security and requires an explicit owner-approved risk
decision. The UI error mapping can be reverted independently, but doing so should not disable the
provider setting. If provider availability causes an incident, preserve redacted Auth request IDs
and timestamps, contact Supabase, and follow the incident-response runbook without logging
passwords.

## Audit findings

| Priority | Classification | Finding                                                                                 | Action                                                                             |
| -------- | -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P1       | Confirmed      | No repository evidence proves leaked-password protection is enabled in hosted Supabase. | Require plan and Dashboard evidence plus staging verification.                     |
| P1       | Confirmed      | Native enforcement is limited to Pro Plan and above.                                    | Mark Free deployments blocked rather than adding client-only screening.            |
| P1       | Possible       | Hosted lookup outage behavior is not evidenced for the deployed project.                | Confirm fail-open/fail-closed behavior with Supabase and record the accepted risk. |
| P2       | Confirmed      | The UI previously converted `weak_password` into a generic error.                       | Map only the stable error code to actionable, privacy-safe guidance.               |
| P2       | Confirmed      | A custom client/Edge checker would create a bypassable parallel boundary.               | Keep password screening inside Supabase Auth.                                      |

## References

- Supabase password security: <https://supabase.com/docs/guides/auth/password-security>
- Supabase Auth password-strength implementation: <https://github.com/supabase/auth/blob/master/internal/api/password.go>
- Supabase Auth configuration: <https://github.com/supabase/auth/blob/master/internal/conf/configuration.go>
- Supabase Auth hooks: <https://supabase.com/docs/guides/auth/auth-hooks>
