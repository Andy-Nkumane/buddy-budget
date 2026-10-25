# Account recovery security

Status: implemented in the application and local Auth configuration; hosted configuration requires verification.

## Enforcement boundaries

Buddy Budget uses Supabase Auth's Authorization Code with PKCE flow. The reset request always shows
the same completion state whether an account exists, the provider rejects the request, or a network
request fails. The browser never receives account-existence information from application copy.

The reset page requires all of the following before showing the new-password form:

1. an authorization `code` query parameter;
2. successful `exchangeCodeForSession` completion using the PKCE verifier retained by Supabase;
3. a `PASSWORD_RECOVERY` Auth event for that exchange.

An ordinary authenticated session does not authorize this route. Supabase controls code expiry and
single use. The application removes the authorization code from the visible URL as soon as exchange
begins so it is not retained in later navigation, screenshots, or copied addresses.

After Supabase accepts the new password, the application requests global sign-out. This revokes
refresh sessions at the provider boundary and returns the user to sign-in. Already-issued access
tokens may remain usable until their configured JWT expiry. If revocation reports an error after the
password update, the UI accurately distinguishes that partial result and instructs the tester to
close the browser and contact the test administrator.

Local Auth sets `auth.email.secure_password_change = true`. Hosted projects must enable and verify
the equivalent **Secure password change** setting; repository configuration does not prove the
hosted value. Recovery-session behavior must be validated before rollout.

Signed-in users can also change their password from Settings. That flow sends the current and new
passwords directly to Supabase Auth, never to the application database. Settings is protected by
the MFA assurance route when the account has a verified factor. After a successful change, Buddy
Budget applies the same global sign-out and fresh-sign-in behavior as recovery.

## Findings

| Priority | Classification | Finding                                                                                                                                                    | Resolution or owner action                                                                                         |
| -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P1       | CONFIRMED      | A successful reset previously retained the recovery session and navigated directly to financial data.                                                      | The application now globally signs out after the password update and requires a fresh sign-in.                     |
| P2       | CONFIRMED      | The one-use authorization code remained visible in the browser URL after exchange began.                                                                   | The code is removed with `history.replaceState` before the asynchronous exchange.                                  |
| P2       | CONFIRMED      | Local secure-password-change enforcement was not enabled.                                                                                                  | Enabled in `supabase/config.toml`; hosted configuration remains CONFIGURATION REQUIRED.                            |
| P2       | CONFIRMED      | Signed-in users had no supported current-password change flow.                                                                                             | Settings now sends `current_password` to Supabase, applies the shared password policy, and globally signs out.     |
| P2       | POSSIBLE       | Hosted redirect allowlists, recovery expiry, email templates, security-change notifications, SMTP identity, and delivery limits cannot be proven from Git. | Verify each item in a disposable staging project and retain redacted evidence.                                     |
| P2       | LIKELY         | A person who controls the mailbox can use recovery to take over the account; TOTP does not independently protect an email recovery flow.                   | Keep mailbox security and assisted MFA recovery in the owner runbook; do not claim recovery is phishing-resistant. |

## Hosted configuration checklist

- Set the Site URL to the exact production GitHub Pages application root.
- Add exact HTTPS callback and reset paths for production and staging. Do not use broad production
  wildcards and do not retain localhost entries in the production project.
- Ensure recovery templates use the provider's redirect value correctly and do not place tokens in
  third-party analytics or remote image URLs.
- Verify recovery expiry and email-send/token-verification limits against the approved policy.
- Enable **Secure password change** and test recovery separately from a normal signed-in password
  change.
- Enable the provider's password-change notification if supported, confirm it contains no password,
  token, financial data, or misleading support claim, and verify sender-domain controls.
- Confirm JWT expiry remains bounded; revocation cannot invalidate an already-issued JWT instantly.
- Keep CAPTCHA and abuse-monitoring decisions aligned with `auth-abuse-protection.md`.

## Disposable staging verification

Use only dedicated test accounts and synthetic data.

1. Request recovery for an existing and an absent address; compare only user-visible application
   behavior, which must remain neutral.
2. Open the valid link in the same browser that initiated PKCE and confirm the code disappears from
   the address before the form is used.
3. Confirm an expired link, a replayed link, an altered code, a link opened on another device, and a
   normal authenticated visit cannot display or submit the reset form.
4. Reset the password and confirm the new password works, the old password fails, the current browser
   returns to sign-in, and refresh attempts in a second browser session fail after provider
   revocation takes effect.
5. Repeat with TOTP enrolled and confirm the subsequent sign-in requires its MFA challenge.
6. Verify redacted Auth logs and notification delivery without recording email addresses, codes,
   tokens, passwords, QR secrets, or financial data.

## Rollback

The code changes require no database migration. If application rollback is necessary, retain the
provider's secure-password-change setting and exact redirect allowlist. Reverting global sign-out
restores the prior recovery session behavior and should be treated as a security regression. Any
provider-setting rollback must first be tested with disposable recovery and signed-in password-change
flows.

## References

- Supabase password authentication: <https://supabase.com/docs/guides/auth/passwords>
- Supabase password security: <https://supabase.com/docs/guides/auth/password-security>
- Supabase PKCE flow: <https://supabase.com/docs/guides/auth/sessions/pkce-flow>
- Supabase redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase sessions: <https://supabase.com/docs/guides/auth/sessions>
