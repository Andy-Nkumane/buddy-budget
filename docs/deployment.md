# Deployment

## Shareable report Edge Function

After applying database migrations, deploy `share-report` with `supabase functions deploy share-report --no-verify-jwt`. Public snapshot viewing has no JWT, while the function explicitly authenticates and authorizes create, list, and revoke requests. See `docs/shareable-reports.md` for threat controls and manual checks.

## GitHub Pages

1. Link the intended Supabase project and run `npx supabase db push` before deploying the frontend. Confirm migrations through `202610040001_add_household_collaboration.sql` are applied successfully. Rehearse existing-user adoption against staging and compare per-table row counts before production.
2. Run `npm run test:db` against an isolated local Supabase stack, then smoke-test transaction creation, CSV import/reimport/undo, schedule creation and confirmation, forecasts, month close/reopen, locked-month adjustments, historical locking, insight filters, and multi-currency separation in staging.
3. Create/select the GitHub repository and push the project to `main`.
4. Open Settings → Pages and choose **GitHub Actions**.
5. Open Settings → Actions → General and allow the repository workflows.
6. Add Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Run `Quality`; deployment starts only after it succeeds.
8. Confirm `https://<owner>.github.io/<repo>/` loads.
9. Refresh `/demo`, `/calculator`, `/app/help`, `/app/transactions`, `/auth/callback`, and `/auth/reset-password` directly.
10. Test locally with `npm run preview:pwa`, not `npm run dev`: Vite's development/HMR runtime requires a live WebSocket and is not an offline deployment simulation. Visit `http://localhost:5173/demo` online once and wait for its service worker to activate. Reload once so the page is controlled, switch the browser offline, reload again, and confirm plan editing, sample transactions, and reset still work without network requests. Clearing site data removes the cached assets and requires another online visit.
11. Inspect `manifest.webmanifest`, `sw.js`, and shortcut URLs under `/<repo>/`; confirm the lazy demo and calculator chunks are included in the precache manifest.
12. Confirm the calculator canonical URL includes the repository base path and that editing it produces no Supabase request.
13. Add the final callback/reset URLs to the Supabase Auth redirect allowlist.

## Authorised tester registration gate

Before exposing any deployed registration route, apply migration `202610170001_add_tester_signup_allowlist.sql`, add approved lower-case tester emails to `buddy_budget_private.tester_signup_allowlist`, and select `public.authorize_tester_signup` under **Authentication > Hooks > Before User Created**. Test one approved address and one unapproved address. The unapproved request must return the generic authorised-testers error and must not create an Auth user.

Hosted Auth-hook selection is not deployed by the frontend or proven by `supabase db push`. Until the hook is enabled and verified in that project, turn off **Allow new users to sign up** under Supabase Auth general configuration. Hiding the registration link or using a browser environment variable is not an access control. See `docs/compliance/registration-transparency.md` for the evidence checklist.

## Required pull-request checks

The `Quality` workflow runs the formatting, lint, type, unit, dependency-audit, production-build, secret-scan, migration, and database/RLS checks for every pull request. Its final `Quality gate` job succeeds only when both the web and database jobs succeed.

To prevent a failed or pending check from being merged into `main`, configure a repository ruleset once:

1. Push `.github/workflows/quality.yml` and let the `Quality` workflow complete at least once so GitHub registers its check name.
2. Open **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
3. Name it `Protect main`, set enforcement to **Active**, and target the default branch (`main`).
4. Enable **Require a pull request before merging**.
5. Enable **Require status checks to pass**, search for and select `Quality gate`, and enable **Require branches to be up to date before merging**.
6. Enable **Block force pushes** and **Restrict deletions**. Do not add bypass actors unless an emergency process explicitly requires them.
7. Save the ruleset, then confirm a pull request cannot merge while `Quality gate` is pending or failed.

If the repository does not offer rulesets, configure the equivalent under **Settings → Branches → Add branch protection rule** for `main`. Repository administrators must configure this in GitHub; a workflow file cannot enforce its own required-check status.

The project URL and publishable key are browser-public even if GitHub variables are used for convenient management. Never add a secret/service-role key to a frontend workflow.

## Routing strategy

Vite emits assets at the configurable base. GitHub Pages serves `public/404.html` for unknown direct routes; that small page preserves the path, query, and fragment in a root redirect. The application restores them before React Router starts.

Tradeoffs: one redirect on direct nested loads, a GitHub-specific fallback file, and reliance on Pages’ 404 behavior. Benefits: clean URLs and PKCE callback paths without hash routing. Verify this whenever the repository name, Pages mode, or custom domain changes.

## Custom domain

Configure the domain in GitHub Pages settings and DNS; a `CNAME` file alone does not complete setup. Build with `VITE_BASE_PATH=/`, update the Supabase site URL/redirect allowlist, enable HTTPS enforcement, and retest the service-worker scope. Do not assume project-path routing on a custom root domain.

## Configurable-header hosting

If moving to Cloudflare Pages or another host, add response headers rather than relying only on meta CSP:

- `Content-Security-Policy` matching actual Supabase origins
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling unused capabilities
- `frame-ancestors 'none'` in CSP

Do not cache Auth callbacks, Supabase APIs, exports, or authenticated HTML. Fingerprinted JS/CSS/icons may use long immutable caching; `index.html`, the manifest, and service worker need revalidation-friendly policies.

Authoritative references: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), and [`vite-plugin-pwa` service-worker registration](https://vite-pwa-org.netlify.app/guide/register-service-worker).

## Weekly check-in delivery

Weekly check-ins require the `weekly-checkin` Edge Function, Mailjet API credentials, and the Cron/Vault values used by migration `202609250001_add_weekly_checkins.sql`. These are server secrets; they must never be GitHub Pages variables or `VITE_` values.

1. Verify the Mailjet sender address or domain. Use an API key and secret key, not SMTP credentials.
2. Copy `supabase/functions/.env.example` to the ignored `supabase/functions/.env.local` for local testing and replace its placeholders.
3. Store production secrets with `npx supabase secrets set --env-file supabase/functions/.env.local`.
4. Deploy with `npx supabase functions deploy weekly-checkin`.
5. In the Supabase SQL editor, create Vault secrets named `buddy_budget_project_url` and `buddy_budget_service_role_key`. Their values are the project URL and service-role key. Restrict dashboard/project access because the service-role key bypasses RLS.
6. Confirm the `buddy-budget-weekly-checkins` Cron job runs every 15 minutes and that its `net._http_response` records return successful responses. Do not log or copy authorization headers while troubleshooting.
7. Opt in with a staging account, preview the summary, send one in-app test and one email test, then opt out and verify the next dispatch creates no delivery.

The function rechecks preferences immediately before each delivery. Provider rejections can retry up to three total attempts. A network interruption after an email request is not retried automatically because the provider outcome is ambiguous; operators can inspect the non-sensitive `failed_final` state without exposing message content or credentials. Mark a preference `bounced` or `blocked` when Mailjet reports that state; the dispatcher will suppress further email delivery until it is safely resolved. Account deletion cascades preferences and delivery history.

## Shared template links

Apply migration `202610120001_add_shared_template_links.sql` and redeploy `share-report` with `--no-verify-jwt`. Public template preview shares the same narrowly scoped Edge endpoint as shared reports; authenticated publish, list, revoke, and copy actions still validate the JWT server-side. No new secret is required. Verify the GitHub Pages fallback preserves `/template` and its URL fragment, and confirm the deployed page emits `noindex`, `nofollow`, and `noarchive` metadata.

## Backup restore operations

Migration `202610020001_add_backup_restore.sql` must be applied before schema-v10 exports are offered. It needs no additional browser or server secret. After deployment, use a disposable staging account to export, merge, replace, download the restore report, and exercise `rollback_backup_restore` with the reported snapshot ID. Confirm that notification delivery rows and provider data are absent. Keep normal Supabase backup/PITR retention enabled; recovery snapshots are account-scoped safeguards, not infrastructure backups.
