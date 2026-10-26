# Authentication operations runbook

Review date: 26 October 2026  
Audience: private-test support, Supabase owners, repository owners, and incident responders

## Operating rules

- Use disposable staging accounts for verification. Never test password guessing, recovery abuse,
  or token replay against production users.
- Never request, copy, screenshot, or log a password, session token, recovery link, TOTP secret,
  one-time code, tester allowlist, or financial payload.
- Record timestamps, stable provider error codes, request IDs when safe, environment, affected
  control, and actions taken. Redact user identifiers from shared evidence.
- Escalate suspected disclosure through `docs/compliance/incident-response.md` and use
  `docs/compliance/breach-notification.md` for the owner/legal notification decision. Do not invent
  a notification deadline or claim automated reporting.

## Leaked-credential response

1. **Triage without reproducing the secret.** Identify its credential class, environment, owner,
   likely exposure window, and where it could grant access. Treat database passwords, service-role
   keys, JWT signing material, SMTP credentials, OAuth secrets, GitHub tokens, and recovery/session
   tokens as sensitive. A publishable browser key is intentionally public but still warrants
   project/configuration review when found unexpectedly.
2. **Contain.** Revoke or rotate the credential at its authoritative provider before editing the
   repository. For session or JWT-signing compromise, involve the Supabase owner to invalidate
   affected sessions and assess signing-key rotation. Restrict administrator access and pause the
   affected deployment or workflow if continued use could expand exposure.
3. **Preserve evidence.** Record commit/artifact identifiers, timestamps, affected systems, and
   redacted scanner output. Do not paste the credential into tickets, chat, documentation, or CI
   logs. Preserve relevant provider audit logs under the approved retention process.
4. **Remove and remediate.** Remove the current occurrence. Decide whether Git history or artifact
   rewriting is required only after rotation and with repository-owner approval; coordinate any
   history rewrite because it disrupts clones and open branches. Correct the source secret store,
   scope, and access path.
5. **Verify.** Confirm the old credential is rejected, the replacement is available only to the
   intended server/workflow, application and CI checks pass, and no browser bundle contains it.
   Run `npm run test:secrets` and the tracked-history gitleaks CI job.
6. **Assess and notify.** Determine access and data impact using provider logs without exporting
   sensitive payloads. The responsible owner decides notifications with the incident and breach
   playbooks; a scanner finding alone does not prove access or a personal-information breach.
7. **Close.** Record corrective actions, rotation owner/date, monitoring period, residual risk, and
   a follow-up prevention task. Never record the replacement value.

## Password reset and account recovery

### Self-service password reset

1. Direct the user to the application forgot-password route. Support must not trigger recovery from
   an unverified third-party message or ask the user to forward the recovery link.
2. The page always uses a neutral completion response. Do not confirm whether an address has an
   account.
3. The user opens the newest recovery email in the same browser context needed for PKCE and sets a
   policy-compliant password. The reset page must reject an ordinary signed-in session and a code
   not identified by Supabase as a password-recovery event.
4. After success, Buddy Budget globally signs out. Confirm the user can sign in with the new
   password and, when enrolled, complete the TOTP challenge. Do not ask for either value.
5. For local testing with Mailpit, follow `local-password-reset-testing.md`. For hosted delivery
   failures, inspect provider health and redacted delivery metadata; do not weaken confirmation or
   redirect settings.

### Signed-in password change

Use Settings > Change password. The user provides the current password locally to Supabase and
chooses a new password. A successful change globally signs out all sessions. A revocation failure
must be reported accurately; support should ask the user to retry sign-out, not claim every session
ended.

### Lost authenticator

1. If another verified authenticator is available, the user signs in, reaches AAL2, enrolls and
   verifies a replacement, then removes the lost factor.
2. If every factor is lost, do not ask for a TOTP secret or code. Escalate to the named private-test
   support owner and Supabase administrator using the approved identity-verification process.
3. Record the factor action and administrator without copying factor identifiers into shared
   evidence. Review recent sessions and material account activity for possible compromise.
4. Buddy Budget does not issue recovery codes. Do not promise automatic recovery or bypass the
   AAL2 database boundary. If assisted recovery is not staffed and verified, suspend MFA enrollment
   rather than enrolling additional users.

### Suspected mailbox compromise

Treat password recovery as compromised because control of the mailbox can authorize a reset.
Advise the user to secure the mailbox through its provider, globally revoke Buddy Budget sessions,
reset the Buddy Budget password from a trusted device, restore MFA, and review household access.
Escalate suspected unauthorised access through the incident process.

## Monitoring and alert recommendations

Thresholds must be baselined in staging and approved by the security operations owner. Do not add
arbitrary numeric thresholds merely to complete this document.

| Signal                                                | Source                            | Alert or review condition                                                                     | Safe evidence                                                  | Owner action                                                                             |
| ----------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Repeated sign-in or signup throttling                 | Supabase Auth logs/metrics        | Material increase above the approved private-test baseline or sustained provider throttling   | Aggregate counts, environment, stable error code, time window  | Check automation/credential stuffing, provider health, rate limits, and CAPTCHA decision |
| Tester-hook denial or execution failure               | Supabase Auth/Postgres logs       | Hook failure, bypass indication, or unexpected increase in denied registration                | Aggregate outcome and function/request identifier              | Pause signup, verify hook configuration and allowlist expiry behavior                    |
| Recovery email spike or delivery failure              | Supabase Auth and SMTP provider   | Unexpected volume, bounce/failure increase, or provider outage                                | Aggregate delivery state and redacted provider event ID        | Check reset abuse, sender/DNS health, and provider escalation                            |
| MFA enrollment/challenge/factor-removal failures      | Supabase Auth logs                | Sustained failures, provider error increase, or multiple lockout reports                      | Aggregate operation/error code; never QR data, secret, or code | Validate hosted MFA settings, time synchronization, and recovery staffing                |
| AAL/RLS authorization denials                         | PostgreSQL/API logs               | Unexpected denial after deployment or access succeeding where a denial is expected            | Policy/function name, role, redacted request ID                | Run focused pgTAP/staging reproduction; treat unexpected success as an incident          |
| Global sign-out or password-change revocation failure | Application support and Auth logs | Any reproducible failure to revoke refresh sessions                                           | Environment, operation, safe provider code                     | Contain affected session risk and verify Auth service health/settings                    |
| Privileged credential or administrator change         | Supabase/GitHub audit logs        | New admin, permission increase, key rotation, or service-role use outside approved change     | Actor role, action, time, approval reference                   | Validate approval, remove unexpected access, rotate exposed credentials                  |
| Secret or vulnerable dependency finding               | GitHub quality workflow           | Any gitleaks positive, scanner-fixture failure, high-severity dependency review/audit failure | Redacted rule/package/advisory and commit                      | Block merge; classify, rotate if needed, patch or document an owner-approved exception   |
| CI security-test regression                           | GitHub quality workflow           | Any secret, web, database, or aggregate quality job fails                                     | Job/check name and commit only                                 | Block promotion until resolved and rerun the full affected gate                          |

Recommended alert destinations must be access-controlled, staffed, and tested. Keep financial data,
email addresses, access tokens, request bodies, passwords, recovery links, and MFA material out of
logs and alerts. Record provider log retention, alert destination, primary owner, backup owner, and
last exercise date outside public documentation.

## Operational exercises

Before private-test rollout and after a material Auth change:

- inject a synthetic secret into the scanner's temporary fixture and prove the negative and
  positive controls behave as documented;
- use disposable staging accounts to exercise allowed/denied signup, neutral reset responses,
  reset replay rejection, password change, global logout, TOTP challenge, lost-factor escalation,
  and cross-user denial;
- simulate a leaked privileged credential without creating or exposing a real one, walk through
  containment and evidence decisions, and confirm all named owners can access the runbook;
- exercise one monitoring signal through its alert destination using synthetic metadata; and
- record gaps, owners, and remediation dates without declaring production controls verified from a
  tabletop result.

## Escalation and closure record

For every recovery or incident case, record: environment, start/end time, case owner, affected
control, safe evidence location, containment, validation performed, user-facing outcome, residual
risk, and follow-up owner. Do not record secrets or unnecessary personal/financial data. Close a
case only when the authoritative provider reflects the intended state and the affected security
test or operational check passes.
