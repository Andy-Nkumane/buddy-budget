# Architecture

## Runtime shape

BuddyBudget is a static React SPA deployed from Vite output. There is no custom application server in V1.

```text
React UI → feature/application logic → repositories → Supabase JS → Auth/PostgreSQL
```

- React Router owns navigation and UX-only authentication/onboarding guards.
- `AuthProvider` restores and observes the Supabase-managed browser session.
- TanStack Query owns server state, invalidation, retry, and optimistic cache updates.
- React Hook Form and Zod own form state and untrusted-input validation.
- Repositories are the only frontend modules that issue database queries.
- PostgreSQL RLS, constraints, and secured functions are the authorization/data-integrity boundary.

## Domain boundaries

- `auth`: registration, verification callback, sign-in/out, recovery, session restoration.
- `onboarding`: transactional first profile/template/current-month setup.
- `budgets`: independent monthly snapshots, totals, temporary item pausing, inline drafts, debounced saves, one-offs.
- `templates`: recurring plans used only when creating a future snapshot.
- `categories`: user-owned classification independent from income/expense type.
- `settings`: display preferences, export, deletion.
- `pwa`: install prompt, connectivity status, safe explicit update lifecycle.

## Historical correctness

`budget_month_items` copy template name, category name, default amount, item type, and order. They retain optional source IDs for lineage, but render and calculate from snapshot fields. A paused item retains its amount while being excluded from totals. No trigger propagates later template updates into a month.

## Autosave

Amount input remains local and updates the query cache for immediate totals. After 650 ms without another keystroke, a validated fixed-decimal string is sent. State transitions are `idle → saving → saved` or `idle/saving → failed`. Failed and offline drafts remain visible for explicit retry. Service-worker activation is disabled while editing/saving.

Cross-tab saves publish only a month ID timestamp through `localStorage`; the other tab receives a `storage` event, invalidates that query, and displays a notification. No financial value is stored in this channel.

## Static SPA tradeoff

The client must hold Supabase refresh/access tokens in provider-managed browser storage. RLS limits what stolen tokens can access but cannot remove browser-token exposure. A future backend-for-frontend can exchange PKCE codes server-side and use Secure, HttpOnly, SameSite cookies. That option adds server operations, CSRF controls, cookie rotation, and cost; it is deliberately outside V1.
