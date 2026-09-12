# BuddyBudget — Codex Implementation Prompt

You are the lead engineer responsible for implementing **BuddyBudget**, a secure, responsive monthly budget-tracking web application.

Build the application—not merely a prototype or implementation plan. Use the BuddyBudget Product Design Report and this Figma file as design references:

<https://www.figma.com/design/GGA8HqCd2SGYbnWT4jMLxH>

If anything conflicts, prioritize:

1. Data and authorization security
2. Historical budget correctness
3. Core monthly-budgeting usability
4. Mobile accessibility
5. Simplicity
6. Visual fidelity

## Working method

Before making changes:

1. Inspect the repository and read any `AGENTS.md`, README, package configuration, and existing architecture.
2. Preserve valid existing work and unrelated user changes.
3. Produce a short implementation plan based on what actually exists.
4. Ask questions only when a missing decision genuinely blocks implementation.
5. Implement in complete, testable phases.
6. Run formatting, linting, type checking, tests, and production builds after material changes.
7. Do not claim something works unless it has been verified.

Do not deploy, create paid resources, purchase domains, or expose credentials without explicit authorization.

When current provider behavior matters, consult official documentation for Supabase, GitHub, Vite, React, and the selected PWA tooling. Document any important assumption that could change over time.

## Required technology stack

Use TypeScript throughout wherever technically possible.

- React
- TypeScript with strict mode enabled
- Vite
- React Router
- TanStack Query for server state
- Supabase JavaScript client
- Supabase Auth
- Supabase PostgreSQL
- PostgreSQL Row-Level Security
- React Hook Form with Zod validation
- Vitest and React Testing Library
- Playwright for critical end-to-end flows
- ESLint and Prettier
- `vite-plugin-pwa` or an equally well-supported Vite PWA solution
- GitHub Actions
- GitHub Pages-compatible production output

Do not use Redux unless the implemented requirements prove it is necessary. Prefer localized component state, React context for authentication, and TanStack Query for remote data.

Avoid unnecessary abstraction, microservices, custom servers, and premature infrastructure.

## Product definition

BuddyBudget is a monthly budgeting companion based on this workflow:

```text
Create recurring template
→ create a monthly snapshot
→ adjust the month
→ see what remains
```

Tagline:

> **Your month. Under control.**

A template contains recurring income and expense items. Each template item can have a default amount; when no default is supplied, use zero.

When a month is created, copy the template items and their current defaults into independent monthly records. Subsequent template changes must never alter existing monthly budgets.

A user must be able to add one-off income or expenses directly to a month without adding them to the template. Offer an optional action to add that item to the template for future months.

## Required user journeys

### Authentication

Implement:

- Register with email and password
- Email verification state
- Sign in
- Sign out
- Forgot password
- Reset password
- Restore an existing session
- Handle expired sessions
- Redirect authenticated and unauthenticated users correctly

Use Supabase-managed sessions with:

- Authorization Code with PKCE
- Short-lived JWT access tokens
- Rotating refresh tokens

Do not create a custom JWT implementation.

Never put secret keys, service-role keys, database passwords, SMTP passwords, OAuth client secrets, or private API keys in browser code. The browser may receive only the Supabase URL and browser-safe publishable key.

### Onboarding

A first-time user should:

1. Register and verify their account.
2. Select currency, locale, and timezone.
3. Create a default monthly template.
4. Add recurring income and expenses.
5. Create the current month from that template.
6. Arrive at the monthly budget editor.

Keep onboarding short and allow items with zero values.

### Monthly budget

The primary screen must allow users to:

- Navigate between months
- See total income
- See total expenses
- See remaining balance
- See savings rate when income is greater than zero
- Edit item amounts inline
- Add a one-off income item
- Add a one-off expense item
- Rename or archive month-only items where appropriate
- See saving, saved, save-failed, and retry states
- Continue from their last-opened month after returning

Use optimistic updates with debounced autosave. Do not require a large global Save button. Never silently discard edits.

### Month creation

When an authenticated user opens the application:

- Restore their last route and month when appropriate.
- If the current calendar month does not exist, create it exactly once from the current default template.
- Do not automatically create arbitrary past or future months merely because the user navigates to them.
- Show an explicit **Create this month** action for missing historical or future months.

Month creation must be an authenticated, idempotent, transactional database operation. Do not issue a collection of unrelated client-side inserts.

Enforce:

```sql
UNIQUE (user_id, month_start)
```

### Templates

Users must be able to:

- View their default template
- Create additional templates
- Select one default template
- Add income and expense items
- Supply an optional default amount
- Edit template items
- Reorder items
- Archive items without destroying historical data
- See a clear message that template changes apply only to newly created months

### Month history

Provide a responsive list of existing months showing:

- Month
- Total income
- Total expenses
- Remaining balance
- Current-month status

Selecting a month opens its budget editor.

### Categories

Support user-owned categories separated from item type.

Examples:

- Type: Income or Expense
- Category: Housing, Utilities, Groceries, Transport
- Item: Rent, Electricity, Weekly groceries

Users must be able to create, rename, reorder, and archive their categories.

### Settings and data ownership

Provide:

- Display name
- Currency
- Locale
- Timezone
- Theme preference
- JSON export containing all user-owned budgeting data
- CSV export for individual months
- Account sign-out
- Account-deletion flow design, even if final deletion requires a protected backend function

Exports must not be service-worker cached.

### Help and user instructions

Include an in-app **How BuddyBudget works** page covering:

1. Creating a template
2. Creating a month
3. Editing monthly values
4. Adding one-off items
5. Understanding totals
6. Reviewing previous months
7. Exporting data
8. Installing the PWA on Android, iOS, and desktop
9. What works offline
10. Protecting the user’s account

## Database model

Create version-controlled Supabase migrations for this model.

### `profiles`

- `user_id uuid primary key`
- `display_name text`
- `currency_code varchar`
- `locale text`
- `timezone text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `user_preferences`

- `user_id uuid primary key`
- `last_budget_month_id uuid nullable`
- `last_route text nullable`
- `theme text`
- `onboarding_completed_at timestamptz nullable`
- `updated_at timestamptz`

### `categories`

- `id uuid primary key`
- `user_id uuid not null`
- `item_type` constrained to income or expense
- `name text`
- `sort_order integer`
- `archived_at timestamptz nullable`
- timestamps

### `budget_templates`

- `id uuid primary key`
- `user_id uuid not null`
- `name text`
- `is_default boolean`
- `archived_at timestamptz nullable`
- timestamps

Ensure each user has no more than one active default template.

### `template_items`

- `id uuid primary key`
- `template_id uuid not null`
- `user_id uuid not null`
- `category_id uuid nullable`
- `item_type` constrained to income or expense
- `name text`
- `default_amount numeric(14,2) not null default 0`
- `sort_order integer`
- `archived_at timestamptz nullable`
- timestamps

### `budget_months`

- `id uuid primary key`
- `user_id uuid not null`
- `source_template_id uuid nullable`
- `month_start date not null`
- `currency_code varchar`
- `status text`
- `notes text nullable`
- `last_opened_at timestamptz`
- timestamps

### `budget_month_items`

- `id uuid primary key`
- `budget_month_id uuid not null`
- `user_id uuid not null`
- `source_template_item_id uuid nullable`
- `category_id uuid nullable`
- `item_type` constrained to income or expense
- `name_snapshot text`
- `category_snapshot text nullable`
- `default_amount_snapshot numeric(14,2) not null default 0`
- `amount numeric(14,2) not null default 0`
- `sort_order integer`
- timestamps

Keep `user_id` on child records deliberately so RLS policies remain simple and efficient. Add database constraints or triggers preventing a child record’s `user_id` from differing from its parent owner.

Use fixed-precision decimal values for money. Never store money using floating-point database types.

Do not store income, expense, remaining, or savings-rate totals as authoritative duplicated columns. Derive them from monthly items.

## Transactional month creation

Implement a secured PostgreSQL function similar to:

```text
create_month_from_template(month_start, template_id)
```

It must:

- Determine ownership using `auth.uid()`
- Reject unauthenticated access
- Verify that the template belongs to the current user
- Create the month and item snapshots in one transaction
- Copy names, categories, ordering, types, and default amounts
- Be idempotent
- Handle concurrent browser tabs
- Return the existing month when it was already created
- Use a safe, fixed `search_path`
- Have minimal grants
- Never trust a caller-supplied `user_id`

## Authorization requirements

Enable RLS on every exposed user-owned table.

Create explicit policies for permitted `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations. The effective ownership rule is:

```text
auth.uid() = row.user_id
```

Use both `USING` and `WITH CHECK` where appropriate.

Frontend route guards are only user-experience controls. The database is the authorization boundary.

Add automated RLS tests using at least two users, Alice and Bob, proving:

- Alice can read Alice’s records.
- Alice cannot read Bob’s records.
- Alice cannot update Bob’s records.
- Alice cannot delete Bob’s records.
- Alice cannot insert a row claiming to belong to Bob.
- Alice cannot attach an item to Bob’s parent record.
- Anonymous users cannot access private budget records.

Treat these tests as release-blocking.

## Indexes

At minimum, plan and create suitable indexes for:

- Unique `budget_months(user_id, month_start)`
- `budget_months(user_id, updated_at)`
- `budget_month_items(budget_month_id, sort_order)`
- `budget_month_items(user_id)`
- `budget_templates(user_id)`
- `template_items(template_id, sort_order)`
- `categories(user_id, item_type)`
- Columns used frequently by RLS policies

## Security requirements

Implement security from the beginning:

- No custom JWT implementation
- No secret or service-role key in frontend code
- No `dangerouslySetInnerHTML`
- Validate untrusted input with Zod
- Rely on parameterized Supabase APIs
- Use least-privilege database grants
- Use strict authentication redirect allowlists
- Add a restrictive Content Security Policy suitable for selected dependencies
- Minimize third-party scripts
- Add dependency and secret scanning in CI
- Prevent open redirects
- Avoid sensitive values in logs and analytics
- Do not cache auth requests, tokens, API responses, exports, or private financial data in the service worker
- Ensure destructive actions require confirmation or provide undo
- Add basic rate-limit and error-handling provisions around repeated operations
- Document the limitations of a static client-side SPA and the future option of an HttpOnly-cookie backend-for-frontend

GitHub Pages has limited control over HTTP security headers. Implement the strongest safe client-side or meta policy possible and document which headers should be added if hosting moves to Cloudflare Pages or another configurable host.

## PWA requirements

Make BuddyBudget installable on supported Android, iOS, and desktop browsers. Android is a first-class target, not an incidental browser layout.

Include:

- Complete web app manifest
- Application icons
- Standalone display mode
- Correct theme and background colours
- Install prompt UX when supported
- Android installation guidance
- iOS Add to Home Screen guidance
- Update-available notification
- Offline-status notification
- Safe service-worker update lifecycle

Initially cache only:

- Application shell
- Versioned JavaScript and CSS
- Icons and local fonts
- Public static help content

Do not initially support offline editing of budget data. Show existing application chrome and a clear offline message, but do not imply unsynced financial edits are persisted safely.

Ensure PWA `start_url`, scope, asset URLs, shortcut URLs, and router base work when hosted at a GitHub project path such as:

```text
https://username.github.io/buddy-budget/
```

### Android manifest requirements

The manifest must include at least:

- `id`
- `name`
- `short_name`
- `description`
- `start_url`
- `scope`
- `display: standalone`
- `background_color`
- `theme_color`
- Appropriate orientation behavior
- Application categories
- Regular application icons
- Maskable icons
- Install-prompt screenshots where supported
- Useful Android application shortcuts

Provide at least:

- 192×192 regular icon
- 512×512 regular icon
- 192×192 maskable icon
- 512×512 maskable icon

Do not create a maskable icon by simply reusing artwork that will be clipped. Keep important logo content within the maskable safe zone.

Suggested shortcuts:

- Current month
- Months
- Templates
- Add expense

All shortcut URLs must respect the GitHub Pages base path.

### Android interaction requirements

Verify:

- Android system back-button navigation behaves predictably.
- Standalone mode does not create navigation loops.
- The application respects display cutouts and safe areas.
- Bottom navigation does not conflict with Android browser or system controls.
- Forms remain usable when the virtual keyboard is open.
- Money fields use an appropriate mobile input mode.
- Touch targets are at least 48×48 CSS pixels where practical.
- Focused controls are not hidden behind the virtual keyboard.
- Scrolling is not locked accidentally.
- Portrait layouts work at narrow Android widths.
- Landscape mode remains usable.
- Theme colours integrate sensibly with Android browser chrome.
- Long-press, selection, and copy behavior are not unnecessarily disabled.
- Installed and browser modes both work.

### Android installation experience

Implement a non-intrusive installation experience using supported browser events.

The application should:

- Detect whether it is already running in standalone mode.
- Capture `beforeinstallprompt` when available.
- Show an **Install BuddyBudget** action at an appropriate moment.
- Let the user dismiss the prompt.
- Avoid repeatedly nagging the user.
- Detect successful installation where supported.
- Provide manual Android installation instructions when the automatic prompt is unavailable.

The Help page should explain:

1. Open BuddyBudget in Chrome on Android.
2. Open the browser menu.
3. Select **Install app** or **Add to Home screen**.
4. Confirm installation.
5. Launch BuddyBudget from the home screen or application drawer.

Browser wording varies by Android and Chrome version, so keep instructions adaptable.

### Android offline behavior

The installed Android PWA may load its cached application shell while offline, but must not imply financial data can safely be edited offline.

When offline:

- Show an obvious offline status.
- Prevent or clearly disable server-dependent mutations.
- Preserve any currently focused unsaved value safely in the interface.
- Do not pretend an edit has been saved.
- Retry only through an explicit, understandable mechanism.
- Never service-worker-cache authentication tokens or private Supabase responses.

Full offline financial editing and background synchronization are outside V1 scope.

### PWA update behavior

Implement a safe service-worker update lifecycle.

When a new version is available:

- Notify the user.
- Avoid reloading while an amount is being edited or saved.
- Offer an explicit update action.
- Reload only when safe.
- Avoid leaving old and new application assets mixed together.

Do not package an APK, Android App Bundle, Trusted Web Activity, or Play Store release in V1. Document these only as possible future distribution options.

## GitHub Pages routing

Use a configurable Vite base path.

Implement and test a GitHub Pages-compatible SPA routing strategy, including direct-route refresh handling. Ensure it works for:

- `/buddy-budget/`
- Authentication callback URLs
- Password-reset URLs
- Nested application routes
- Service-worker scope
- Manifest paths
- Static assets
- Android app shortcuts

Document the selected routing strategy and its tradeoffs.

## Responsive design

Follow the supplied Figma design as closely as practical.

The visual style should feel:

- Friendly
- Calm
- Trustworthy
- Clear
- Lightweight
- More like a helpful planning companion than banking software

Use an 8-point spacing system with 4px subdivisions.

### Desktop

- Sidebar navigation
- Header with save status and profile menu
- Three summary cards
- Inline-editable budget rows
- Income and expenses clearly separated
- Strong visible hierarchy without decorative chart overload

### Tablet

- Collapsible navigation
- Responsive summary grid
- Compact editable rows

### Mobile

- No horizontally scrolling desktop tables
- Stacked editable rows
- Compact remaining-balance summary
- Bottom navigation
- Touch targets of at least 48×48 CSS pixels where practical
- Sticky or easily reachable primary actions
- Full feature parity with desktop

Target at least:

- 1440×1024 desktop
- 768×1024 tablet
- 390×844 mobile
- 360×800 small mobile

## Accessibility

Target WCAG 2.2 AA.

Include:

- Semantic page structure
- Proper form labels
- Keyboard-accessible navigation and dialogs
- Visible focus states
- Screen-reader-friendly save and error announcements
- Sufficient colour contrast
- Touch-friendly controls
- Meaning that does not depend on colour alone
- Reduced-motion support
- Accessible validation messages
- Correct dialog focus trapping and restoration

## Required application states

Design and implement:

- Initial loading
- First-time onboarding
- No template
- Missing month
- Normal editor
- Saving
- Saved
- Save failed with retry
- Offline
- Session expired
- Database unavailable
- Empty income or expense section
- Deleted item with undo
- Another tab changed the same month
- PWA update available
- Invalid or extremely large monetary input
- Zero-income calculations
- Negative remaining balance

## Suggested project organization

Organize by domain instead of placing everything in a generic components directory:

```text
src/
  app/
    layout/
    providers/
    routing/
  features/
    auth/
    onboarding/
    budgets/
    templates/
    categories/
    settings/
    help/
  shared/
    ui/
    validation/
    formatting/
    hooks/
    utilities/
  data/
    supabase/
    repositories/
  pwa/
  test/

supabase/
  migrations/
  seed/
  tests/

public/
docs/
```

Use this dependency direction:

```text
UI
→ feature/application logic
→ repository layer
→ Supabase
```

Avoid scattering direct Supabase calls across presentation components.

## Documentation deliverables

Create a comprehensive root-level `README.md` that enables a developer to go from a fresh clone to a working local and hosted application without undocumented knowledge.

Also create:

```text
docs/
  architecture.md
  database.md
  deployment.md
  external-resources.md
  pwa-testing.md
  security-checklist.md
  troubleshooting.md
```

The root README must summarize the process and link to detailed documents.

### Required README structure

The README must contain:

1. Product overview
2. Screenshots or links to the Figma design
3. Architecture summary
4. Technology stack
5. Repository structure
6. Prerequisites
7. Quick-start instructions
8. Environment-variable reference
9. Supabase setup
10. Authentication setup
11. Database migration and seed instructions
12. Local development
13. Testing
14. Production build
15. GitHub Pages deployment
16. Android PWA installation and testing
17. Security considerations
18. External resources required from the owner
19. Troubleshooting
20. Known limitations
21. Backup and recovery responsibilities

All commands must be copy-pasteable and match the actual package manager and scripts in the repository. Do not document commands that were not tested or do not exist.

## External-resource documentation

Create `docs/external-resources.md` with a checklist explaining every external account, project, setting, URL, credential, and manual action required.

Separate the checklist into:

- Required for local development
- Required for hosted staging
- Required for production
- Optional enhancements
- Information or access required from the application owner

For every external resource, document:

- Why it is needed
- Who must create it
- Where it is configured
- Which value BuddyBudget needs
- Whether the value is public or secret
- Where the value should be stored
- How to verify that it works
- Common configuration mistakes
- Whether it can create a cost
- Whether a free tier can be used initially

Do not invent credentials, project IDs, URLs, or account details.

If access to an external service is unavailable, implement the local integration boundary, create safe placeholders, document the exact manual action required, and report it as remaining setup.

## Supabase setup documentation

Document the complete Supabase setup process, including:

1. Creating a Supabase organization and project
2. Selecting an appropriate region
3. Protecting the database password
4. Finding the project URL
5. Finding the browser-safe publishable key
6. Installing and authenticating the Supabase CLI
7. Linking the local repository to the correct project
8. Starting Supabase locally
9. Applying migrations
10. Loading development seed data
11. Running database and RLS tests
12. Configuring authentication
13. Configuring email verification
14. Configuring password-reset emails
15. Configuring allowed redirect URLs
16. Configuring the production site URL
17. Optional custom SMTP configuration
18. Backup and recovery considerations
19. Separating local, staging, and production environments

Clearly distinguish:

```text
Browser-safe:
- Supabase project URL
- Supabase publishable key

Secret:
- Database password
- Supabase secret or service-role key
- SMTP credentials
- OAuth provider secrets
- Deployment or CLI access tokens
```

Secret values must never be:

- Committed to Git
- Added to frontend source
- Included in Vite browser variables
- Printed in logs
- Included in screenshots
- Included in example files with realistic-looking values

Create a committed `.env.example` containing placeholders only.

Use `.env.local` or another appropriate ignored file for local values. Verify that secret-bearing environment files are covered by `.gitignore`.

The browser configuration should use:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_BASE_PATH=
```

Explain that all `VITE_` values are embedded in the public frontend bundle and must never contain secrets.

The application should fail with a useful configuration message when required public environment values are missing.

## Authentication URL documentation

Document the exact redirect URLs required for:

- Local sign-in
- Local email verification
- Local password reset
- GitHub Pages sign-in
- GitHub Pages email verification
- GitHub Pages password reset
- An optional custom production domain

Support a GitHub project URL such as:

```text
https://username.github.io/buddy-budget/
```

Ensure authentication redirects respect the configured base path. Do not leave redirect URLs as vague instructions. Provide exact patterns with clearly marked placeholders.

## GitHub setup documentation

Document:

1. Creating or selecting the GitHub repository
2. Installing dependencies
3. Pushing the project
4. Enabling GitHub Pages
5. Selecting GitHub Actions as the Pages deployment source
6. Configuring workflow permissions
7. Adding required repository variables or secrets
8. Running the CI workflow
9. Confirming the deployed base URL
10. Adding that URL to Supabase’s authentication allowlist
11. Testing direct-route refresh behavior
12. Testing the service-worker scope
13. Optional custom-domain configuration

Explain that the Supabase URL and publishable key are public browser configuration even if GitHub Actions stores them as repository secrets to simplify management.

Never place a Supabase secret or service-role key in a frontend deployment workflow.

## What is needed from the owner

The README must contain a prominent checklist listing what is still required from the project owner.

At minimum, address:

- Supabase project creation or access
- Supabase project URL
- Supabase publishable key
- Confirmation of development and production URLs
- GitHub repository owner and repository name
- Final GitHub Pages URL
- Optional custom domain
- Preferred production region
- Preferred currency, locale, and timezone defaults
- Email sender name and address
- Optional SMTP provider credentials
- Optional OAuth provider configuration
- Final application logo and brand assets
- Privacy-policy URL before public launch
- Terms-of-service URL before public launch
- Support email address
- Access to an Android device or emulator for final acceptance testing

Mark each item as one of:

```text
Required now
Required before deployment
Required before public launch
Optional
```

Never ask the owner to paste secret credentials into source files or documentation.

## Testing requirements

Add meaningful tests, not merely snapshots.

### Unit tests

Cover:

- Money parsing and formatting
- Income and expense totals
- Remaining balance
- Savings-rate edge cases
- Validation rules
- Template-to-month mapping
- Autosave state transitions

### Component tests

Cover:

- Budget-row editing
- Saving and failure feedback
- Authentication guards
- Empty states
- Responsive navigation behavior
- Accessible dialogs

### Database tests

Cover:

- RLS isolation
- Cross-parent ownership constraints
- Transactional month creation
- Duplicate month attempts
- Historical snapshot integrity
- Single active default template

### End-to-end tests

Cover the critical path:

1. Register or use a seeded test account.
2. Complete onboarding.
3. Create a template.
4. Create the current month.
5. Change a monthly amount.
6. Verify autosave.
7. Reload.
8. Verify the value persisted.
9. Edit the template.
10. Verify the existing month did not change.
11. Create a one-off item.
12. Review month history.
13. Export data.
14. Sign out and sign back in.

## Android PWA testing

Create `docs/pwa-testing.md` containing an Android test matrix.

At minimum, test:

- Chrome on a real Android device or Android emulator
- Browser mode
- Installed standalone mode
- Fresh installation
- Reinstallation
- Application update
- Online startup
- Offline startup
- Slow network
- Session restoration
- Session expiration
- Sign-in and sign-out
- Email-verification redirect
- Password-reset redirect
- Editing with the virtual keyboard
- Android back button
- Portrait orientation
- Landscape orientation
- Small-screen layout
- GitHub Pages base path
- Service-worker update
- Clearing site data and recovering cleanly

Run Lighthouse PWA checks and record meaningful failures or limitations. Do not treat Lighthouse alone as sufficient Android testing.

Document how to inspect:

- The manifest
- Service-worker registration
- Cached assets
- Installability
- Standalone display
- Network requests
- Offline behavior

## CI/CD

Create GitHub Actions workflows that perform:

1. Dependency installation
2. Formatting check
3. Linting
4. Type checking
5. Unit and component tests
6. Database and RLS tests where the CI environment supports Supabase
7. Production build
8. Dependency vulnerability checks
9. Secret scanning
10. GitHub Pages deployment only after quality checks pass

Use pinned or appropriately constrained action versions and minimal workflow permissions.

## Seed and development experience

Provide safe development seed data representing:

- A default template
- Income items such as Salary and Freelance
- Expenses such as Rent, Electricity, Groceries, Transport, and Entertainment
- At least two historical months

Do not allow production builds to accidentally load another user’s seed data.

Use ZAR as the example currency while keeping currency and locale configurable.

## Scope exclusions

Do not implement these in V1:

- Bank integrations
- Transaction imports
- Receipt scanning
- AI financial advice
- Household sharing
- Subscription billing
- Multi-currency amounts within one monthly budget
- Complex analytics dashboards
- Native mobile applications
- APK or Android App Bundle packaging
- Trusted Web Activity or Play Store release
- Microservices
- An admin interface exposing users’ financial data
- Full offline financial editing

Leave clear extension points only when they do not complicate the current implementation.

## Completion criteria

The implementation is complete only when:

- The application runs locally.
- TypeScript passes with strict settings.
- Tests pass.
- The production build succeeds.
- A new developer can set up the application from the README.
- Every external dependency is documented.
- Required owner-provided information is listed.
- Public and secret configuration values are clearly distinguished.
- Supabase setup is reproducible.
- Authentication flows are wired to Supabase.
- Authentication redirect URLs are documented and tested.
- RLS policies and cross-user tests exist.
- Template changes cannot rewrite historical months.
- Monthly creation is transactional and idempotent.
- Autosaved changes survive reload and new sessions.
- The primary workflow works on desktop and mobile.
- GitHub Pages deployment is reproducible.
- GitHub Pages base-path behavior works in browser and standalone modes.
- The PWA is installable on a supported Android device or emulator.
- Regular and maskable Android icons are valid.
- Installed Android navigation works.
- Android virtual-keyboard behavior is usable.
- Android offline messaging is honest and safe.
- Service-worker updates do not discard edits.
- Private data is excluded from service-worker caching.
- No secret is exposed in the frontend bundle.
- All setup commands in the README correspond to implemented scripts.
- Setup, architecture, security, Android PWA behavior, and deployment are documented.
- Remaining manual actions are explicitly reported.

## Final handoff

At the end, provide:

1. A concise implementation summary
2. Files and areas changed
3. Commands executed and their results
4. Credentials or external setup still required from the owner
5. Known limitations
6. Security decisions
7. Android PWA verification results
8. Recommended next steps

Include a clearly labeled section:

```text
External setup still required from you
```

For each remaining action, state why it is required, where it must be completed, whether it involves sensitive information, and how to verify completion.

If the entire application cannot reasonably be completed in one run, finish the largest coherent, runnable milestone first. Do not leave the core architecture in a half-working state. Record remaining work in a prioritized implementation checklist.
