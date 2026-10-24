# Multi-factor authentication

Status: opt-in TOTP implemented; hosted verification and recovery operations required  
Last reviewed: 24 October 2026

## Scoped audit

| Priority | Classification | Finding                                                                                                                      | Remediation                                                                                                                                                            |
| -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | CONFIRMED      | Enrolled accounts previously had no challenge flow, AAL gate, factor management, or trusted protection for account deletion. | Add TOTP enrollment, challenge routing, AAL checks, factor management, and PostgreSQL enforcement for deletion.                                                        |
| P1       | CONFIRMED      | No self-service recovery mechanism exists when every authenticator is lost.                                                  | Support multiple TOTP factors and document an administrator-assisted recovery process. Recovery codes remain blocked while the installed provider API is experimental. |
| P2       | CONFIRMED      | Supabase passkey and recovery-code APIs are experimental in the installed SDK/provider documentation.                        | Do not make either experimental API a production dependency in this phase. Reassess after stable support and a migration review.                                       |
| P2       | CONFIRMED      | TOTP is susceptible to real-time phishing.                                                                                   | Label the limitation plainly and do not describe TOTP as phishing-resistant.                                                                                           |
| P2       | POSSIBLE       | Hosted MFA enrollment/challenge controls cannot be verified from repository evidence.                                        | Capture redacted Dashboard evidence and complete disposable staging validation.                                                                                        |

## Implemented flow

- MFA is opt-in so existing users are not locked out.
- Settings can enroll and verify one or more TOTP authenticator apps.
- The enrollment QR code and manual secret exist only in component memory and disappear after
  completion or cancellation. They are not logged or persisted by Buddy Budget.
- Cancelling setup removes the unverified provider factor.
- After password sign-in, an enrolled `aal1` session is redirected to `/auth/mfa` before onboarding
  or authenticated application routes render.
- Successful verification upgrades the Supabase session to `aal2` and returns to the intended
  in-app route.
- Removing a verified factor is available only from an `aal2` session and requires an explicit
  confirmation.
- Account deletion for an enrolled user requires a recent password authentication followed by a
  TOTP verification. PostgreSQL independently rejects deletion unless the JWT is `aal2`.

The global route gate is a usability control. Supabase Auth enforces factor enrollment, challenge,
verification, and removal. PostgreSQL is the trusted enforcement boundary for protected account
deletion. RLS-wide AAL enforcement for all financial reads and writes is intentionally deferred to
the dedicated sessions/RLS phase because it requires a comprehensive policy migration and
cross-user matrix rather than piecemeal policy edits.

## Method decision

Supabase supports stable app-authenticator TOTP and phone factors. TOTP was selected because it does
not introduce SMS delivery, phone-number collection, or an additional messaging provider. TOTP
codes are shared-secret authenticators and can be phished.

Supabase marks passkey support experimental and requires explicit SDK opt-in plus stable
relying-party configuration. The documented passkey flow is passwordless sign-in; the installed SDK
also exposes experimental WebAuthn MFA types. Neither is adopted until the API, hosted
configuration, recovery behavior, and relying-party migration constraints are stable and tested.
Buddy Budget does not claim phishing-resistant authentication in this phase.

## Recovery and factor replacement

Users should enroll a second authenticator before replacing or losing a device. A user who can
verify any remaining factor can enter the app at `aal2`, add a replacement, and remove the old
factor.

If every factor is lost, self-service recovery is not available. An authorised test administrator
must:

1. verify the request through the separately approved tester-support channel without asking for a
   password, TOTP secret, session token, or recovery link;
2. use Supabase Dashboard Auth user factor management to inspect and remove only the affected
   factor;
3. revoke the user's existing sessions;
4. notify the account email through the approved channel; and
5. record the operator, UTC timestamp, user identifier, reason, and outcome without financial data
   or credential material.

The exact identity-proofing procedure, authorised operators, support contact, and retention are
**OWNER-DEPENDENT release blockers**. Do not remove a factor solely because an email requester can
state the account address.

Supabase recovery codes are experimental in the installed SDK and require explicit client and
server enablement. They are **BLOCKED** pending stable provider support, a one-time display/download
design, secure regeneration and removal flows, and a reviewed recovery policy.

## Dashboard configuration required

For staging and production, record redacted evidence for:

1. Authentication → Multi-Factor settings permit TOTP enrollment, challenge, and verification.
2. MFA verification hooks are either absent or their exact behavior and failure mode are reviewed.
3. MFA endpoint rate limits remain enabled.
4. The project's site URL and redirects still match the GitHub Pages deployment.
5. Administrator MFA is enabled separately for people who can access the Supabase organisation.

Do not enable experimental WebAuthn MFA or recovery codes merely because the installed SDK contains
their types.

## Disposable staging verification

1. Enroll TOTP on a disposable staging account and save no QR-code screenshots or secrets.
2. Confirm enrollment signs other sessions out as documented by Supabase.
3. Confirm a new password login is routed to the MFA challenge before financial UI is rendered.
4. Confirm an incorrect and an expired code fail without exposing provider diagnostics.
5. Confirm a valid code reaches `aal2` and restores the intended route.
6. Add a second factor, verify either factor can be selected, and safely remove one.
7. Confirm an `aal1` direct call to `delete_own_account()` is rejected for an enrolled account and
   the same operation succeeds only after recent password authentication and MFA verification.
8. Exercise administrator-assisted recovery only with a disposable account, then revoke all
   sessions.

## Rollback

The UI can be reverted without deleting provider factors, but users with enrolled factors would no
longer receive the application challenge and must not be left in that state. Before UI rollback,
disable or safely remove disposable factors and confirm the production recovery plan. The database
migration is forward-only; rollback requires a reviewed follow-up migration restoring the previous
`delete_own_account()` definition. Never edit an applied migration.

## References

- Supabase MFA overview: <https://supabase.com/docs/guides/auth/auth-mfa>
- Supabase TOTP MFA: <https://supabase.com/docs/guides/auth/auth-mfa/totp>
- Supabase AAL API: <https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel>
- Supabase experimental passkeys: <https://supabase.com/docs/guides/auth/passkeys>
