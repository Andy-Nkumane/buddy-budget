# Authentication abuse protection

Status: repository controls implemented; hosted controls require owner verification  
Scope: password sign-in, authorised-tester registration, and password-reset requests  
Last reviewed: 24 October 2026

This document does not prove that a hosted Supabase project is configured as described. Dashboard
settings and controlled staging evidence are release requirements.

## Scoped code audit

| ID         | Priority | Classification | Evidence                                                                                                                                                                   | Impact                                                                                               | Risk and verification                                                                                                                         | Action                                                                                                                             |
| ---------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-006-A | P1       | POSSIBLE       | The repository cannot inspect hosted Auth rate-limit values, CAPTCHA state, Auth logs, or alerts. Local configuration contains no explicit rate-limit or CAPTCHA settings. | Public Auth endpoints may rely only on unknown provider defaults.                                    | Changing limits too aggressively can deny legitimate users. Record current values first and validate changes with disposable staging users.   | **CONFIGURATION REQUIRED:** verify limits and decide on CAPTCHA in the Supabase Dashboard.                                         |
| AUTH-006-B | P2       | CONFIRMED      | Sign-in previously mapped every provider failure, including HTTP 429, to the credential-failure message.                                                                   | A throttled user could repeatedly retry without useful guidance.                                     | A special message must be based only on stable provider code/status and must not expose account state.                                        | Map documented Supabase rate-limit codes and status 429 to neutral retry guidance.                                                 |
| AUTH-006-C | P2       | CONFIRMED      | Password-reset success and provider-error responses previously rendered different screens.                                                                                 | Provider behavior or configuration changes could expose a response-content account-existence signal. | A neutral completion response can obscure service failures. Monitor provider health separately; do not expose account state to the requester. | Return the same neutral completion state after every completed reset request.                                                      |
| AUTH-006-D | P2       | LIKELY         | The browser calls Supabase Auth directly, so timing remains provider/network dependent.                                                                                    | Response timing could remain an enumeration signal even when text is generic.                        | Client-added delays are bypassable and can harm accessibility. Verify provider behavior in staging without high-volume attempts.              | Accept as provider-bound residual risk; do not implement React or local-storage throttling.                                        |
| AUTH-006-E | P2       | POSSIBLE       | No approved operational threshold or notification destination exists for Auth abuse signals.                                                                               | Sustained spraying or automation may not be noticed promptly.                                        | Exporting identifiers or full request payloads would add privacy risk.                                                                        | Define aggregate thresholds and an owner-reviewed alert route using provider logs; never log passwords, tokens, or request bodies. |

No P0 finding was confirmed in this scoped review. `AUTH-006-A` remains open until hosted evidence
exists.

## Enforcement boundaries

- Supabase Auth is the trusted enforcement boundary for credential verification, IP/user rate
  limits, email-send quotas, and CAPTCHA token verification.
- PostgreSQL's authorised-tester hook is the trusted registration-admission boundary when it is
  enabled in the hosted project.
- The React application only maps provider outcomes to safe messages. It does not count attempts,
  lock accounts, claim to block bots, or override a provider decision.
- Permanent account lockouts are not used. They can be triggered by an attacker to deny service to
  a victim.

Supabase documents a `429 Too Many Requests` response when an Auth rate limit is exceeded. The UI
recognises status 429 and the documented `over_request_rate_limit`, `over_email_send_rate_limit`,
and `over_sms_send_rate_limit` codes. It deliberately does not display raw provider messages or a
made-up countdown.

## Enumeration-safe responses

| Flow                                      | Public response                                                                                   | Account-specific information exposed?                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Sign-in failure                           | Email/password incorrect or sign-in unavailable                                                   | No                                                                       |
| Sign-in rate limit                        | Too many attempts; wait before retrying                                                           | No; the signal concerns provider throttling, not account existence       |
| Production registration failure           | Account could not be created; verify tester/password requirements or sign in                      | No                                                                       |
| Local-development duplicate registration  | Explicit localhost-only duplicate guidance                                                        | Yes, intentionally limited to a development build on a loopback hostname |
| Password-reset request                    | The same “If an account exists” completion screen for provider success, rejection, and throttling | No                                                                       |
| Invalid/expired callback or recovery link | Generic invalid/expired-link response                                                             | No                                                                       |

The registration response for a breached password remains actionable because it describes the
submitted password, not whether an account exists. Provider diagnostic text is never rendered.

## Supabase configuration required

For each staging and production project, an owner must use **Authentication → Rate Limits** to
record the current settings before changing them. Supabase currently documents these relevant
defaults:

- sign-up and sign-in requests: 30 requests per five minutes per IP, with a burst capacity of 30;
- token endpoint requests, including password grants: 150 requests per five minutes per IP, with a
  burst capacity of 30;
- password-reset requests: a 60-second window for the same user;
- email sent by the built-in Auth email provider: two emails per hour for the project.

Defaults and available controls can change. Treat the Dashboard as authoritative and attach
redacted evidence to the release record. Choose values that accommodate shared networks used by
authorised testers. Do not enable forwarded-IP handling for this browser-direct architecture.

### CAPTCHA decision

Supabase supports hCaptcha and Cloudflare Turnstile for sign-in, sign-up, and password reset. Do
not enable CAPTCHA in the Dashboard until the matching frontend widget and `captchaToken` request
integration are deployed together; otherwise authentication will fail.

Before implementation, the owner must:

1. choose and approve a provider, accessibility behavior, privacy terms, region/transfer impact,
   retention, and availability trade-offs;
2. add the provider to the processor and privacy records where applicable;
3. store the provider secret only in the Supabase Dashboard, never in Vite variables or Git;
4. expose only the provider's public site key to the browser;
5. test keyboard, screen-reader, reduced-motion, failure, expiry, and token-reset behavior; and
6. retain a safe rollback path that disables both the hosted check and frontend widget together.

Until those decisions are complete, CAPTCHA is **CONFIGURATION REQUIRED**, not implemented or
claimed.

## Controlled staging verification

Never execute these checks against production. Use a disposable staging project and accounts.

1. Record existing rate-limit values and the project reference without including access tokens.
2. Temporarily lower one staging-only limit enough to reach it with a few requests.
3. Make the minimum requests needed to receive one HTTP 429 response.
4. Verify the sign-in page shows neutral retry guidance, keeps focus/navigation usable, and allows
   another attempt after the provider window resets.
5. Submit reset requests for one disposable registered address and one reserved nonexistent
   address. Verify the visible content is identical. Compare timing only as diagnostic evidence;
   do not generate statistically significant traffic.
6. Verify one legitimate sign-in succeeds after the window resets.
7. Restore the original setting and record the owner, UTC timestamp, project, before/after values,
   and result.

## Monitoring and privacy

Supabase Auth audit logs are the preferred source because they are generated at the enforcement
boundary. Review aggregate counts of failed sign-ins, repeated signups, recovery requests, and 429
responses over a defined interval. Establish a normal staging baseline before selecting alert
thresholds.

Do not add browser analytics for credentials or Auth failures. Do not copy email addresses, IP
addresses, passwords, CAPTCHA tokens, access/refresh tokens, recovery links, or request bodies into
application logs or alerts. If investigation requires an account correlation value, use the
minimum provider-held identifier with access controls and approved retention. Alert routing,
thresholds, log retention, and response ownership remain **OWNER-DEPENDENT**.

## Rollback

The UI change can be rolled back by reverting the error-mapping and neutral reset-response changes;
this does not alter accounts or database data. Hosted rate-limit changes must be restored to their
recorded prior values. CAPTCHA rollback must disable the Dashboard requirement and remove the
frontend widget in the same release window. No database migration is involved.

## References

- Supabase Auth rate limits: <https://supabase.com/docs/guides/auth/rate-limits>
- Supabase Auth CAPTCHA: <https://supabase.com/docs/guides/auth/auth-captcha>
- Supabase Auth error codes: <https://supabase.com/docs/guides/auth/debugging/error-codes>
- Supabase Auth audit logs: <https://supabase.com/docs/guides/auth/audit-logs>
- OWASP Authentication Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- OWASP Forgot Password Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
