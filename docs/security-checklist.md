# Security checklist

## Before each release

- [ ] `npm run audit`, lint, type check, tests, database tests, and production build pass.
- [ ] Secret scanning reports no credential, token, realistic example secret, `.env.local`, database URL password, or exported financial file.
- [ ] The bundle contains only the intended Supabase URL and publishable key—never service role, secret key, database password, SMTP password, OAuth secret, or CLI/GitHub token.
- [ ] RLS remains enabled on every exposed user-owned table and policies cover SELECT/INSERT/UPDATE/DELETE with `USING`/`WITH CHECK` as appropriate.
- [ ] Alice/Bob/anonymous RLS and cross-parent tests pass.
- [ ] New security-definer functions derive `auth.uid()`, use fixed `search_path`, qualify objects, validate ownership, revoke default execution, and grant minimally.
- [ ] Destructive operations require explicit confirmation or a recoverable undo.
- [ ] Redirect destinations are fixed or allowlisted; no query parameter can produce an open redirect.
- [ ] CSP/connect origins match only deployment needs; no new third-party scripts or `dangerouslySetInnerHTML`.
- [ ] Service-worker caches contain no Supabase/Auth responses, access/refresh tokens, exports, private financial data, mutation queue, or opaque third-party response.
- [ ] Logs, errors, screenshots, analytics, and support artifacts contain no tokens, passwords, full exports, or unnecessary financial values.
- [ ] Authentication confirmation/recovery URLs are exact for local/staging/production and overly broad wildcards are removed.
- [ ] Access tokens are short-lived, refresh rotation is enabled, email verification is enabled, and abuse/rate limits are appropriate in Supabase.
- [ ] Dependencies and GitHub Actions are reviewed and constrained; workflow permissions remain minimal.
- [ ] Backup retention and a recent non-production restore drill meet the owner’s RPO/RTO.

## Host headers

The meta CSP provides partial protection on GitHub Pages, but `frame-ancestors` and several protections require response headers. On a configurable host, add CSP, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, and an anti-framing policy. Verify with browser network tools and an approved header scanner.

## Incident basics

If a secret is exposed, remove it from use immediately, rotate/revoke it at the provider, inspect audit logs, assess affected environments/data, and rewrite Git history only as a secondary cleanup. If a publishable key is visible, that alone is expected; investigate only if it is actually a secret/service-role value or RLS is broken.

For suspected session compromise, revoke affected sessions, reset credentials, review Auth/database logs without copying sensitive contents, and communicate according to the owner’s incident/privacy policy.
