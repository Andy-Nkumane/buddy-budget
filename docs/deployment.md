# Deployment

## GitHub Pages

1. Create/select the GitHub repository and push the project to `main`.
2. Open Settings → Pages and choose **GitHub Actions**.
3. Open Settings → Actions → General and allow the repository workflows.
4. Add Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Run `Quality`; deployment starts only after it succeeds.
6. Confirm `https://<owner>.github.io/<repo>/` loads.
7. Refresh `/app/help`, `/auth/callback`, and `/auth/reset-password` directly.
8. Inspect `manifest.webmanifest`, `sw.js`, and shortcut URLs under `/<repo>/`.
9. Add the final callback/reset URLs to the Supabase Auth redirect allowlist.

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
