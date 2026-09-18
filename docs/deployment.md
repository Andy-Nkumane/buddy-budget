# Deployment

## GitHub Pages

1. Link the intended Supabase project and run `npx supabase db push` before deploying the frontend. Confirm migrations `202609130002_add_transactions_and_accounts.sql` and `202609140001_add_csv_transaction_imports.sql` are applied successfully.
2. Run `npm run test:db` against an isolated local Supabase stack, then smoke-test transaction creation, CSV import/reimport/undo, and historical locking in staging.
3. Create/select the GitHub repository and push the project to `main`.
4. Open Settings → Pages and choose **GitHub Actions**.
5. Open Settings → Actions → General and allow the repository workflows.
6. Add Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Run `Quality`; deployment starts only after it succeeds.
8. Confirm `https://<owner>.github.io/<repo>/` loads.
9. Refresh `/app/help`, `/app/transactions`, `/auth/callback`, and `/auth/reset-password` directly.
10. Inspect `manifest.webmanifest`, `sw.js`, and shortcut URLs under `/<repo>/`.
11. Add the final callback/reset URLs to the Supabase Auth redirect allowlist.

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
