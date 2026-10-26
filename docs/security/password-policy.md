# Password policy and enforcement

Date: 22 October 2026  
Scope: newly created and reset passwords  
Status: application and local configuration implemented; hosted configuration required

## Policy

Buddy Budget applies a length-first policy to newly set passwords:

- at least 15 Unicode code points in the application;
- no more than 72 UTF-8 bytes, matching Supabase Auth's verified bcrypt boundary;
- spaces, Unicode, paste, autofill, and password-manager generated values are accepted;
- no uppercase, lowercase, number, or symbol composition rule;
- no trimming, silent truncation, or periodic expiry;
- the exact input is sent to Supabase without Unicode normalization.

Sign-in deliberately does not reapply the new-password policy. Existing accounts must be able to
submit their existing credential to Supabase for verification.

## Enforcement boundaries

| Control                                  | Enforcement                                                     | Status                                           |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| 15 Unicode code-point minimum            | Zod validation in registration and reset forms                  | Implemented UX control; bypassable               |
| 15-unit provider minimum                 | Local Supabase Auth configuration and hosted Dashboard setting  | Local implemented; hosted configuration required |
| 72 UTF-8 byte maximum                    | Zod validation and Supabase Auth                                | Implemented                                      |
| Spaces and no composition rules          | Application schema and empty Supabase required-character policy | Local implemented; hosted verification required  |
| No trimming or normalization             | Application schema passes the exact string                      | Implemented                                      |
| Exact trusted Unicode code-point minimum | Supabase Auth counts UTF-8 bytes for its length checks          | Blocked by provider behavior                     |

Supabase Auth currently measures password length with Go's byte length and caps passwords at 72
bytes. Consequently, a direct Auth API request containing fewer than 15 non-ASCII code points can
meet a 15-byte provider minimum. The browser's code-point check improves behavior for normal UI use
but is not a security boundary. Buddy Budget does not add a pretend server hook: the available
before-user-created hook payload does not expose the plaintext password, and the password
verification hook applies to sign-in rather than password creation.

NIST recommends accepting at least 64 characters. Supabase accepts 64 ASCII characters, but its
72-byte provider limit means it cannot accept 64 characters when their UTF-8 representation is
larger than 72 bytes. This provider limitation must remain visible in risk review.

Unicode normalization is intentionally not performed by the application. Normalizing only in the
browser would create inconsistent credentials for direct provider clients, and normalizing an
already entered secret can make the stored credential differ from the user's password-manager
value. Users must enter the same Unicode representation when signing in.

## Hosted Supabase configuration required

For each non-local project, an authorised operator must configure and record:

1. Open **Authentication > Sign In / Providers > Email** in the Supabase Dashboard.
2. Set the minimum password length to `15`.
3. Leave required character classes disabled.
4. Save the setting and capture redacted evidence containing the project/environment, reviewer,
   date, minimum, and required-character state. Do not capture passwords, tokens, or tester emails.
5. In a disposable staging account, verify that 14 ASCII characters are rejected and 15 are
   accepted through a direct Auth request. Do not run password-boundary probes against production.
6. Repeat the settings review for production before deployment; do not infer it from local config.

The hosted project cannot be declared aligned until this evidence exists. See
`breached-password-protection.md` for the separate provider-plan and deployment requirements.

## Compatibility and rollback

The policy applies only when a password is created or reset. It does not force existing users to
rotate credentials and does not block a shorter legacy password at the sign-in form.

No database migration is included. To roll back an application deployment, revert the application
schema, guidance, tests, and local Auth setting together. A hosted minimum should not be lowered
without an explicit security decision; if compatibility requires a lower client minimum, deploy
the matching client before changing the hosted setting so the UI never promises acceptance the
provider will reject.

## Audit findings

| Priority | Classification | Finding                                                                                           | Impact and action                                                                                               |
| -------- | -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P1       | Confirmed      | The prior 14-character minimum was below the 15-character password-only recommendation.           | Raised new/reset validation and local Auth configuration to 15.                                                 |
| P1       | Confirmed      | The prior 128-character client maximum exceeded Supabase Auth's 72-byte limit.                    | Validate the actual UTF-8 byte boundary and give an actionable error before submission.                         |
| P1       | Confirmed      | Supabase's trusted minimum is byte-based, not Unicode-code-point based.                           | Document the provider blocker; retain the client code-point check without presenting it as trusted enforcement. |
| P2       | Confirmed      | Boundary, Unicode, whitespace, preservation, and legacy sign-in behavior lacked focused coverage. | Added deterministic validation and registration tests.                                                          |
| P3       | Confirmed      | Registration and reset guidance still stated 14 characters.                                       | Updated both hints with concise passphrase guidance.                                                            |

## References

- NIST SP 800-63B-4, password requirements: <https://pages.nist.gov/800-63-4/sp800-63b/authenticators/>
- Supabase password security: <https://supabase.com/docs/guides/auth/password-security>
- Supabase Auth password implementation: <https://github.com/supabase/auth/blob/master/internal/api/password.go>
- Supabase Auth hooks: <https://supabase.com/docs/guides/auth/auth-hooks>
