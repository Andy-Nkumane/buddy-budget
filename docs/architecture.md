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
- `budgets`: independent monthly plans, planned-versus-actual progress, temporary item pausing, inline drafts, debounced saves, one-offs.
- `transactions`: manual and browser-local CSV-imported actual income/expense ledger, optional account assignment, categorisation, pagination, duplicate protection, and locked-history controls.
- `templates`: recurring plans used only when creating a future snapshot.
- `categories`: user-owned classification independent from income/expense type.
- `settings`: display preferences, export, deletion.
- `pwa`: install prompt, connectivity status, safe explicit update lifecycle.

## Historical correctness

`budget_month_items` copy template name, category name, default amount, item type, and order. They retain optional source IDs for lineage, but render and calculate from snapshot fields. A paused item retains its amount while being excluded from planned totals. No trigger propagates later template updates into a month.

`budget_transactions` records actual activity separately from the planned snapshot. Amounts and account opening balances use integer minor units. A non-negative refund/reversal record reverses its income or expense effect. Only posted transactions affect actual totals and derived account balances. Transactions linked to paused or later-archived items remain real activity.

Financial accounts contain only a user label, type, currency, opening balance, and archived state. They contain no bank credentials. Current balances are derived from the opening balance and posted transactions by `retrieve_financial_accounts(boolean)` and are never stored as a second mutable total.

CSV statements are decoded and parsed only in browser memory. The client sends normalized transaction fields, mapping metadata, counts, and scoped SHA-256 fingerprints to one secured PostgreSQL operation; it never sends the original file. The RPC serializes matching batch keys, validates the entire bounded request before writing, and inserts the batch plus accepted rows atomically. PostgreSQL's user/source/fingerprint unique index is the final duplicate boundary. Undo removes the batch's transactions only while every affected month remains editable.

Supported imports are UTF-8 CSV files up to 2 MiB, 2,000 data rows, and 100 columns. Delimiters may be comma, semicolon, tab, or pipe; quoted and multiline fields are supported. Users choose YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY dates and automatic, dot, or comma decimals. A signed amount treats positive values as income and negative values as expenses; separate debit/credit columns require exactly one non-zero value. Zero-value and malformed rows are reported rather than silently discarded.

## Autosave

Amount input remains local and updates the query cache for immediate totals. After 650 ms without another keystroke, a validated fixed-decimal string is sent. State transitions are `idle → saving → saved` or `idle/saving → failed`. Failed and offline drafts remain visible for explicit retry. Service-worker activation is disabled while editing/saving.

Cross-tab saves publish only a month ID timestamp through `localStorage`; the other tab receives a `storage` event, invalidates that query, and displays a notification. No financial value is stored in this channel.

## Static SPA tradeoff

The client must hold Supabase refresh/access tokens in provider-managed browser storage. RLS limits what stolen tokens can access but cannot remove browser-token exposure. A future backend-for-frontend can exchange PKCE codes server-side and use Secure, HttpOnly, SameSite cookies. That option adds server operations, CSRF controls, cookie rotation, and cost; it is deliberately outside V1.
