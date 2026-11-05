# MFA recovery codes

Buddy Budget uses Supabase Auth's native experimental recovery-code API rather than implementing a parallel factor store. Supabase generates the codes, stores verification representations server-side, atomically consumes a code once, applies provider rate limits, and returns plaintext only when a set is generated or replaced.

The browser holds newly issued plaintext only in component memory so the user can copy, download, or print it. Codes are not written to local storage, session storage, URLs, application logs, analytics, or the Buddy Budget database. Replacing a set requires password reauthentication, a current authenticator code, and an AAL2 session; all old codes are invalidated by the provider operation.

## Configuration required

The hosted Supabase project must support and enable MFA recovery codes. The JavaScript client explicitly enables the experimental API, but that does not prove server availability. Validate enrollment, single use, replay rejection, remaining count, throttling, regeneration, concurrent redemption, and session assurance with disposable staging accounts before rollout. Do not record codes or TOTP secrets as evidence.

On 5 November 2026, the linked production project's Auth configuration reported TOTP enrollment and verification enabled but did not expose recovery-code enrollment or verification settings. A narrowly scoped Management API update containing only those two recovery-code settings returned success but silently discarded both fields; a follow-up read confirmed they were absent. Production recovery codes are therefore **PROVIDER-BLOCKED**. Production builds keep the recovery-code API and controls disabled unless `VITE_MFA_RECOVERY_CODES_ENABLED=true` is explicitly set. Do not set that deployment variable until Supabase exposes the hosted controls and a disposable production-like account passes the validation matrix above.

The current Supabase CLI does not pass the recovery-code server flags through local `config.toml`. After `npx supabase start`, run `npm run dev:mfa-recovery-codes` through WSL. The local-only helper enables recovery-code enrollment and verification on the stateless Auth container, waits for it to become healthy, and restores the original container if the replacement fails. Run the helper again after recreating or restarting the local stack. It does not change the database or hosted project.

If the provider feature is unavailable, existing TOTP remains usable and the UI must not imply that recovery codes were issued. Keep a second authenticator and the authorised assisted-recovery procedure until staging verification succeeds. Because the provider API is experimental, stage the release and retain the option to disable recovery-code UI while leaving TOTP intact.

Email is not an MFA bypass. A user with neither an authenticator nor an unused recovery code must follow the approved administrator-assisted recovery process.
