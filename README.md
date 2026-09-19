# BuddyBudget

> **Your month. Under control.**

BuddyBudget is a responsive monthly budget companion. Define recurring income and expenses once, create an independent month snapshot, record actual transactions, and compare the plan with what happened. Historical months are never rewritten when a template changes.

## 1. Product overview

The core workflow is:

```text
Create recurring template → create a monthly snapshot → adjust the month → see what remains
```

V1 includes email/password authentication, onboarding, multiple templates, categories, month history, debounced autosave, pausable monthly items, one-off items, manual transactions, local CSV statement import, transparent categorisation rules, ranged JSON/CSV/PDF-report export, account deletion, responsive layouts, and an installable PWA. Bank connections, sharing, multi-currency months, native apps, and offline financial editing are intentionally excluded.

## 2. Screenshots and design

- [Desktop application preview](public/screenshots/desktop-budget.png)
- [Mobile application preview](public/screenshots/mobile-budget.png)
- [BuddyBudget Figma file](https://www.figma.com/design/GGA8HqCd2SGYbnWT4jMLxH)

The supplied Figma URL points to a file rather than a specific node. The implemented visual system follows the written design direction; final node-by-node comparison requires a Figma URL containing `node-id`.

## 3. Architecture summary

BuddyBudget is a static Vite SPA. React components call feature/application logic, which calls a repository layer, which alone accesses Supabase. TanStack Query owns server state, React Context owns the authenticated session, and local component state owns drafts and dialogs.

Supabase Auth issues and rotates the session tokens. PostgreSQL RLS—not route guards—is the authorization boundary. Month creation and onboarding use secured transactional database functions. See [architecture](docs/architecture.md) and [database design](docs/database.md).

## 4. Technology stack

- React 19, TypeScript strict mode, Vite 8, React Router 7
- TanStack Query, React Hook Form, Zod
- Supabase JavaScript client, Auth, PostgreSQL, RLS
- `vite-plugin-pwa` and Workbox
- Vitest, React Testing Library, Playwright, pgTAP
- ESLint, Prettier, GitHub Actions, GitHub Pages

## 5. Repository structure

```text
src/app/                 providers, routing, responsive application shell
src/features/            auth, onboarding, budgets, transactions, templates, categories, settings, help
src/shared/              UI, formatting, validation, types, utilities
src/data/                Supabase client and repository boundary
src/pwa/                 install, offline, and update lifecycle UI
src/test/                shared test setup
supabase/migrations/     versioned schema, RLS, triggers, secured functions
supabase/seed/           local-only development data
supabase/tests/          pgTAP database and RLS tests
e2e/                     Playwright critical-path test
public/                  manifest assets, icons, install screenshots, Pages fallback
docs/                    detailed setup, security, deployment, and PWA guides
```

## 6. Prerequisites

- Node.js 20.19+ (Node 22 is used in CI)
- npm 10+
- Docker Desktop or another Docker-compatible runtime for local Supabase
- A Supabase account and project for hosted environments
- A GitHub repository for GitHub Pages deployment
- Chrome on an Android device or emulator for final PWA acceptance

## 7. Quick start

```bash
npm ci
cp .env.example .env.local
npx supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx supabase db reset
npm run dev
```

After `supabase start`, run `npx supabase status -o env`. Put its API URL and browser-safe anonymous/publishable key in `.env.local`. When running through WSL, open `http://127.0.0.1:5173` from Windows.

The local seed account is `demo@buddybudget.local` with password `buddy-budget-local-only`. It is for local development only and is never bundled into the application.

## 8. Environment-variable reference

| Variable                        | Required | Visibility          | Example purpose                                                        |
| ------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Yes      | Public/browser-safe | Hosted project URL or local API URL                                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes      | Public/browser-safe | Supabase publishable key; a local legacy anon key is also browser-safe |
| `VITE_BASE_PATH`                | Yes      | Public              | `/` locally or `/buddy-budget/` on project Pages                       |

Every `VITE_` value is embedded in the public JavaScript bundle. Never use a database password, secret/service-role key, SMTP credential, OAuth secret, GitHub token, or CLI access token in a `VITE_` variable. Missing public configuration produces an actionable configuration screen.

## 9. Supabase setup

For local development:

```powershell
npx supabase start
npx supabase db reset
npm run test:db
```

For a hosted project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Choose a region near the majority of users, save the generated database password in an approved password manager, and never put it in this repository. Full instructions are in [database.md](docs/database.md) and [external-resources.md](docs/external-resources.md).

## 10. Authentication setup

In Supabase Dashboard → Authentication:

1. Enable email/password sign-up and require email verification in staging/production.
2. Set the site URL to the deployed application root.
3. Add every callback and reset URL below to the redirect allowlist.
4. Customize confirmation and recovery email templates, keeping `{{ .ConfirmationURL }}` intact.
5. Optionally configure custom SMTP; do not put SMTP credentials in frontend variables.

Exact redirect URLs:

```text
Local callback:       http://localhost:5173/auth/callback
Local password reset: http://localhost:5173/auth/reset-password

GitHub callback:       https://<owner>.github.io/<repo>/auth/callback
GitHub password reset: https://<owner>.github.io/<repo>/auth/reset-password

Custom callback:       https://<your-domain>/auth/callback
Custom password reset: https://<your-domain>/auth/reset-password
```

Email verification uses the callback URL. Sign-in itself does not redirect away from the SPA. Supabase is explicitly configured for Authorization Code with PKCE, persisted sessions, short-lived access-token refresh, and rotating refresh tokens.

## 11. Database migrations and seed

`npx supabase db reset` rebuilds the local database, applies all migrations, then loads `supabase/seed/development.sql`. The seed contains only a clearly marked local demo user, a default ZAR template, common categories, two historical months, a sample account, and sample transactions. Production builds do not read seed SQL.

Create future migrations with:

```powershell
npx supabase migration new describe_change
```

Never edit a migration already applied to a shared environment; add a new migration instead.

## 12. Local development

```powershell
npm run dev
```

Use `.env.local` for local public settings. It is ignored by Git. The application deliberately does not fall back to invented credentials.

## 13. Testing

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

The browser tests cover money, planned-versus-actual totals, refunds, account balances, paused items, CSV parsing/mapping/preview, validation, autosave transitions, transaction entry, locked rows, route guards, and accessible dialogs. Database tests use isolated users to prove RLS, ownership constraints, atomic/idempotent CSV imports, secured transaction writes, historical locking, onboarding, and paused-state persistence.

The critical Playwright flow needs a disposable Supabase user and is opt-in:

```powershell
$env:E2E_EMAIL='dedicated-test-user@example.test'
$env:E2E_PASSWORD='a-dedicated-test-password'
$env:E2E='1'
npm run test:e2e
```

Do not run destructive E2E flows against a real person’s production account.

## 14. Production build

```powershell
npm run build
npm run preview
```

The output is written to `dist/`. The service worker precaches versioned application assets and public static content only. Supabase/API responses, authentication traffic, tokens, exports, and private financial records have no runtime cache rule.

## 15. GitHub Pages deployment

1. Create/select the GitHub repository and push this project.
2. In Settings → Pages, select **GitHub Actions** as the source.
3. In Settings → Secrets and variables → Actions → Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Ensure Actions have read access and Pages deployment is allowed.
5. Push to `main`; `Quality` must pass before `Deploy GitHub Pages` runs.
6. Add the final Pages callback/reset URLs to Supabase’s redirect allowlist.

The workflow builds with `/<repository-name>/` as `VITE_BASE_PATH`. `public/404.html` preserves nested SPA routes on a direct Pages refresh. This adds one redirect hop but retains clean browser paths, PKCE query parameters, manifest scope, and shortcut URLs. See [deployment.md](docs/deployment.md).

## 16. Android PWA installation and testing

In Chrome on Android, open BuddyBudget, open the browser menu, choose **Install app** or **Add to Home screen**, confirm, then launch from the home screen or app drawer. When supported, BuddyBudget offers the same browser install prompt non-intrusively.

Verify browser and standalone modes, virtual-keyboard editing, Android back, portrait/landscape, offline startup, update prompting, and base-path routing using [the PWA test matrix](docs/pwa-testing.md).

## 17. Security considerations

- RLS is enabled on every exposed user-owned table with explicit operation policies.
- Child records use composite owner foreign keys, and category/source triggers reject cross-user attachment.
- Transactional functions derive ownership from `auth.uid()` and use a fixed empty `search_path`.
- Money uses `numeric(14,2)` and totals are derived rather than duplicated.
- The browser receives only the project URL and publishable key.
- Zod validates user input; no `dangerouslySetInnerHTML`, custom JWT, analytics, or third-party script is used.
- A restrictive meta CSP is included. GitHub Pages cannot set every desired HTTP header; configure headers when moving to a host that supports them.
- A static SPA stores the Supabase-managed session in browser storage. A future backend-for-frontend could move sessions to Secure, HttpOnly cookies for higher-risk deployments.

Use [security-checklist.md](docs/security-checklist.md) before every release.

## 18. External resources required from the owner

See the full accountable checklist in [external-resources.md](docs/external-resources.md).

### External setup still required from you

| Status                        | Action                                                                         | Why / where                                                 | Sensitive?                                                | Verify                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Required now                  | Create or grant access to a Supabase project and choose its region             | Database and Auth; Supabase Dashboard                       | Project password and secret keys are sensitive            | Project opens and the browser-safe URL/key are visible |
| Required now                  | Supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` | Connect local app                                           | Publishable values are public; do not supply service role | App no longer shows configuration screen               |
| Required before deployment    | Confirm GitHub owner/repository and final Pages URL                            | Base path and Auth redirects                                | No                                                        | Direct nested-route refresh succeeds                   |
| Required before deployment    | Configure Supabase site URL and redirect allowlist                             | Email verification and reset                                | No                                                        | Both emailed links return to the deployed app          |
| Required before public launch | Provide sender identity, privacy URL, terms URL, and support email             | Trust, legal, and support surfaces                          | SMTP password is sensitive                                | Test mail arrives and public links resolve             |
| Required before public launch | Approve final logo/brand assets                                                | Replace provisional generated PWA mark                      | No                                                        | Icons are legible and accepted in installed modes      |
| Required before public launch | Complete Android device/emulator acceptance                                    | Real device behavior cannot be proven by desktop automation | No                                                        | Test matrix is signed off                              |
| Optional                      | Custom SMTP, OAuth providers, and custom domain                                | Deliverability/convenience/branding                         | Provider secrets are sensitive                            | Provider-specific test completes                       |

Store secrets only in Supabase/GitHub provider settings or an approved secret manager—never paste them into source or documentation.

## 19. Troubleshooting

Start with [troubleshooting.md](docs/troubleshooting.md). Common causes are a missing `.env.local`, a redirect URL absent from Supabase, a wrong `VITE_BASE_PATH`, Docker not running, or a stale installed service worker.

## 20. Known limitations

- Financial data cannot be safely edited offline in V1.
- Account deletion relies on the protected database function and must be validated against the target Supabase project’s operational policies.
- GitHub Pages cannot set CSP, HSTS, Permissions-Policy, or anti-framing headers; the meta CSP cannot replace all headers.
- The first release has no household sharing, bank-credential feeds, receipt scanning, billing, native packaging, or advanced analytics. CSV statements can be imported manually without uploading the raw file.
- Emailed Auth flows, real-device Android behavior, Lighthouse results, and final Figma node fidelity require owner-managed external environments.

## 21. Backup and recovery responsibilities

Supabase project owners are responsible for selecting a plan with suitable backup/PITR coverage, recording retention, testing restores, restricting database access, and separating local/staging/production projects. JSON export is a user portability feature, not a system backup. Before destructive migrations, create and verify a provider backup; test restores in a non-production project and document recovery time/recovery point objectives.
