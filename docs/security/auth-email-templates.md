# Supabase authentication email templates

Status: repository sources versioned; hosted activation **CONFIGURATION REQUIRED**  
Template version: `1.0.0`  
Last reviewed: 2 November 2026

## Scope and enforcement boundary

The reviewed sources are under `supabase/templates/auth/v1/`. Supabase Auth generates the action
URL or reauthentication code, renders the Go template, validates the action, and controls token
expiry and reuse. Buddy Budget does not construct, store, log, or inspect those credentials.

The repository config connects the five template types currently supported by the Supabase CLI:
confirmation, invitation, magic link, email change, and recovery. The reauthentication source is
versioned for manual hosted Dashboard deployment because the current CLI configuration reference
does not list reauthentication as an `auth.email.template` type. Do not add an undocumented key to
make local configuration appear complete.

Repository files do not prove that a hosted project uses these templates, that custom SMTP is
active, or that provider tracking is disabled.

## Template contract

| Dashboard template   | Repository source       | Subject                                | Variables used                |
| -------------------- | ----------------------- | -------------------------------------- | ----------------------------- |
| Confirm signup       | `confirmation.html`     | Confirm your Buddy Budget test account | `ConfirmationURL`             |
| Invite user          | `invite.html`           | You're invited to test Buddy Budget    | `ConfirmationURL`             |
| Magic link           | `magic-link.html`       | Your Buddy Budget sign-in link         | `ConfirmationURL`             |
| Change email address | `email-change.html`     | Confirm your Buddy Budget email change | `ConfirmationURL`, `NewEmail` |
| Reset password       | `recovery.html`         | Reset your Buddy Budget password       | `ConfirmationURL`             |
| Reauthentication     | `reauthentication.html` | Your Buddy Budget verification code    | `Token`                       |

Action templates deliberately use the provider-generated `ConfirmationURL`. Buddy Budget does not
currently provide an email-code entry screen, so replacing these links with `Token` would create a
broken flow. Reauthentication is the exception because Supabase supports only the `Token` value in
that template. Buddy Budget currently reauthenticates sensitive actions with a password and does
not request Supabase's email reauthentication message; do not activate an email-code product flow
without adding and testing a corresponding code-entry UI.

Every action link includes `rel="notrack"`. This is a defence in depth setting, not a substitute
for disabling click tracking and URL rewriting in the SMTP provider.

## URL configuration

Configure exact production values in Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://<owner>.github.io/buddy-budget/`
- Redirect URL: `https://<owner>.github.io/buddy-budget/auth/callback`
- Redirect URL: `https://<owner>.github.io/buddy-budget/auth/reset-password`

Use the actual repository owner and deployed base path. Avoid a broad production wildcard. Keep
the localhost callback and reset URLs only where local testing is intended. The application passes
the callback or reset URL through `emailRedirectTo`/`redirectTo`; `ConfirmationURL` retains that
allowlisted destination.

GitHub Pages sends direct routes through `404.html`, which encodes the route and query before the
SPA restores them. Regression tests cover callback and reset paths, query values, multiple query
parameters, and fragments beneath `/buddy-budget/`.

## Safe local preview

1. Run `npm run test:auth-emails` through WSL.
2. Start the disposable local Supabase stack.
3. To exercise confirmation delivery locally, temporarily set `enable_confirmations = true` under
   `[auth.email]`, restart the stack, and restore the committed value when finished.
4. Use a synthetic local address and open the message in local Mailpit.
5. Inspect layout and the `redirect_to` host/path only. Do not copy or retain the token, code,
   complete action URL, QR material, or session fragment in screenshots, logs, or tickets.
6. Request a fresh email after every template or redirect configuration change.

The reauthentication template requires a hosted disposable test or a supported self-hosted Auth
configuration because it is intentionally not wired through an undocumented local CLI key.

## Hosted staging deployment

1. Export the currently active subjects and HTML into approved private operational storage. Do not
   include a delivered message or live action URL.
2. In the staging Supabase Dashboard, open Authentication → Email Templates.
3. Copy each reviewed subject and HTML source into the matching template. Do not paste a template
   into a different flow merely because the layout looks similar.
4. Configure custom SMTP if required by the project plan. Supabase projects created on the free
   tier after 3 June 2026 cannot customize Auth templates while using Supabase's default email
   provider; custom SMTP or a qualifying paid plan is required.
5. In Mailjet, disable open tracking and click tracking/link rewriting for transactional Auth mail.
   Retain `rel="notrack"` on every action link.
6. Verify the exact Site URL and redirect allowlist above with staging equivalents.
7. Send new messages for all six flows using disposable staging accounts. Never reuse an action
   from a message sent before the configuration change.
8. Record redacted evidence of the template version, subject, provider tracking settings, URL
   allowlist, sender authentication, date, reviewer, and result. Do not capture message credentials.

Repeat the reviewed procedure for production only after staging passes. No Management API token is
required or justified for this manual deployment.

## Manual review matrix

For every template, verify:

- the subject and action match the requested flow;
- the message remains understandable with styles and images disabled;
- the action is keyboard accessible and has descriptive text;
- the layout is readable in narrow, dark-mode-capable, and plain-text-oriented clients;
- no account metadata, financial values, tracking pixels, marketing copy, or invented expiry is
  present;
- an unexpected recipient is told not to use the action without confirming whether an account
  exists; and
- the final destination retains `/buddy-budget/` and the exact callback or reset route.

Use redacted screenshots from disposable accounts only. Hide the recipient address, complete URL,
code, query, fragment, and browser history.

## Rollback and incident response

If delivery, rendering, or routing fails, restore the privately retained previous hosted subject and
HTML. Keep the exact redirect allowlist unless investigation proves it is the fault; never broaden
it as a quick fix. Pause affected Auth email testing, request fresh actions after rollback, and use
redacted Supabase/SMTP logs that exclude URLs, authorization headers, tokens, codes, and recipient
addresses.

A repository rollback removes local sources and tests but cannot roll back hosted Dashboard state.
Hosted rollback must be performed and verified separately.

## References

- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase local template configuration](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth testing](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [Mailjet per-link tracking exclusion](https://documentation.mailjet.com/hc/en-us/articles/360042751854-How-to-exclude-a-link-from-being-tracked-when-click-tracking-is-enabled)
