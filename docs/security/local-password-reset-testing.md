# Testing password reset on localhost

Buddy Budget password recovery can be tested entirely on localhost. Local Supabase does not send
recovery messages to a real mailbox. It captures them in Mailpit, which is available at
<http://127.0.0.1:54324> while the local Supabase stack is running.

Use only disposable local accounts and synthetic data. Never reuse a production password, recovery
link, authenticator secret, or real financial information.

## Prerequisites

- Docker Desktop is running with WSL integration enabled.
- The local Supabase stack is running.
- Buddy Budget uses the local Supabase URL and browser-safe local publishable key.
- The application is running at <http://localhost:5173>.
- The local account has an email address and password that satisfy the current password policy.

The repository already permits these exact local reset destinations:

```text
http://localhost:5173/auth/reset-password
http://127.0.0.1:5173/auth/reset-password
```

Local Auth also enables secure password changes. Recovery links remain able to establish a
recovery-authorized session; ordinary signed-in sessions must not substitute for a recovery link.

## Test an in-app password change

1. Sign in to a disposable local account.
2. If TOTP is enrolled, complete the authenticator challenge before opening Settings.
3. Open **Settings**, then find **Change password**.
4. Enter the current password and a different test-only password of at least 15 characters.
5. Confirm Buddy Budget returns to sign-in and reports that the password was updated and existing
   sessions were ended.
6. Confirm the old password no longer signs in and the new password does.
7. If the account is open in a second browser profile, refresh it and confirm its refresh session is
   rejected.

Also verify that an incorrect current password produces a neutral error without exposing provider
diagnostics. As with recovery, an already-issued access token may remain usable until its configured
JWT expiry even after refresh sessions are revoked.

## Start the local services

Run these commands from WSL in the repository directory:

```bash
npx supabase start
npm run dev
```

Confirm the Supabase output includes:

```text
Studio  http://127.0.0.1:54323
Mailpit http://127.0.0.1:54324
```

If `supabase/config.toml` was changed while Supabase was already running, restart it without deleting
the persisted local database:

```bash
npx supabase stop
npx supabase start
```

## Create a disposable local account

1. Open <http://localhost:5173/auth/register>.
2. Register a synthetic address such as `recovery-test@example.test`.
3. Use a unique test-only password of at least 15 characters.
4. Complete onboarding only as far as needed to reach sign-in.
5. Sign out before starting recovery.

Local email confirmation is disabled by the repository configuration, so registration does not need
a confirmation message. This does not disable password-recovery messages.

## Test a successful reset

1. Open <http://localhost:5173/auth/forgot-password>.
2. Enter the disposable account email and select **Send reset link**.
3. Confirm the application shows the neutral **Check your email** response.
4. Open Mailpit at <http://127.0.0.1:54324>.
5. Open the newest recovery message for the disposable address.
6. Open its reset link in the same browser profile that requested the reset.
7. Confirm the reset form appears and the `code` query parameter disappears from the address bar.
8. Enter and confirm a new test-only password of at least 15 characters.
9. Select **Update password**.
10. Confirm Buddy Budget returns to sign-in and reports that the password was updated and existing
    sessions were ended.
11. Confirm the old password no longer signs in.
12. Confirm the new password signs in.
13. If TOTP is enrolled, confirm sign-in still requires the authenticator challenge.

The recovery request and link must be completed in the same browser profile because Supabase PKCE
stores a verifier in that browser. Opening the message in another browser or private window should
fail safely.

## Test required failure cases

Use a disposable account for every destructive or repeated scenario.

### Unknown email address

1. Request recovery for an address that is not registered locally.
2. Confirm Buddy Budget shows the same neutral **Check your email** response.
3. Confirm no application message reveals whether the account exists.

### Incorrect browser or device

1. Request a reset in one browser profile.
2. Copy the local Mailpit link without recording it in logs, screenshots, or source files.
3. Open it in a different browser profile or private window.
4. Confirm the reset form is not authorized and the application gives a generic recovery error.

### Replayed link

1. Complete one successful reset.
2. Open the same Mailpit recovery link again.
3. Confirm the code cannot establish another recovery session.

### Altered or missing code

1. Remove or change the `code` query parameter before the application exchanges it.
2. Confirm the password form does not appear.
3. Confirm no provider diagnostic, verifier, token, or account detail is shown.

### Expired link

The provider controls recovery expiry. For a practical local check, temporarily use a short
`auth.email.otp_expiry` value in `supabase/config.toml`, restart Supabase, request a new recovery
message, wait for that test interval, and confirm the link is rejected. Restore the repository value
after testing. Do not use production to test expiration.

### Session revocation

1. Sign in to the disposable account in two normal browser profiles.
2. Start and complete recovery in the first profile.
3. Confirm the first profile returns to sign-in.
4. Refresh or make a new request from the second profile.
5. Confirm its refresh session is rejected after global sign-out takes effect.

An access token already issued to the second profile may remain usable until its configured JWT
expiry. Local JWT expiry is 3,600 seconds. Do not describe refresh-session revocation as immediate
access-token invalidation.

## Troubleshooting

### No message appears in Mailpit

- Confirm the local Supabase stack is healthy with `npx supabase status`.
- Confirm Mailpit is reachable at <http://127.0.0.1:54324>.
- Confirm the frontend is using the local Supabase URL, not staging or production.
- Wait for the configured email frequency limit before requesting another message.
- Restart the local stack after changes to `supabase/config.toml`.
- Check local Auth container logs without copying tokens, links, email addresses, or passwords into
  issues or documentation.

### The link opens but the reset form is rejected

- Use the same browser profile that requested the link.
- Use the newest recovery message; starting another PKCE flow can replace the earlier verifier.
- Do not refresh or reuse a successfully exchanged link.
- Confirm the URL uses the same hostname used to request recovery. `localhost` and `127.0.0.1` have
  separate browser storage even though both reach the same machine.
- Confirm the exact reset URL is listed in `supabase/config.toml`.

### The new password is rejected

- Use at least 15 Unicode characters.
- Keep the password at or below 72 UTF-8 bytes.
- Do not trim or normalize the value between the password manager and the form.
- If leaked-password protection is enabled in a hosted environment, choose a different password.

## Evidence to record

Record only:

- test date and environment;
- PASS or FAIL for each scenario;
- browser names and versions;
- relevant non-sensitive provider error code, if available;
- whether old sign-in, new sign-in, MFA challenge, replay rejection, and second-session revocation
  behaved as expected.

Never record the recovery URL, authorization code, PKCE verifier, password, access or refresh token,
authenticator secret, local secret key, or real email address.

## References

- Supabase password authentication: <https://supabase.com/docs/guides/auth/passwords>
- Supabase PKCE flow: <https://supabase.com/docs/guides/auth/sessions/pkce-flow>
- Supabase local development: <https://supabase.com/docs/guides/local-development>
- Supabase redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
