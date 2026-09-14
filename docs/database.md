# Database and Supabase setup

## Environments

Use separate Supabase projects for staging and production. Local development uses the CLI-managed Docker stack. Never point automated or seed workflows at production.

## Create a hosted project

1. Create a Supabase organization and project.
2. Choose the production region closest to the expected users and document the choice.
3. Generate a strong database password and store it in an approved password manager.
4. In Project Settings → API, copy the project URL and browser-safe publishable key.
5. Do not copy the secret/service-role key into this repository or any `VITE_` variable.

## CLI setup

The CLI is a development dependency, so commands are reproducible through `npx`:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Login tokens and database passwords are secret. Enter them only in the CLI/provider prompt or an approved CI secret field.

## Local setup

```powershell
npx supabase start
npx supabase db reset
npx supabase status -o env
npm run test:db
```

Copy the local API URL and browser-safe anon key from status output into `.env.local` under `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Model and invariants

- `profiles` and `user_preferences`: one row per Auth user.
- `categories`: user-owned and typed as income/expense.
- `budget_templates` and `template_items`: recurring plans; one active default per user.
- `budget_months`: unique per `(user_id, month_start)`.
- `budget_month_items`: independent, fixed-precision snapshots with a persisted `is_disabled` flag for temporary exclusion from totals.
- `financial_accounts`: optional user-owned cash/current, savings, and credit labels with integer-minor-unit opening balances and no bank credentials.
- `budget_transactions`: user-owned manual or CSV-imported actual activity tied to a month and optionally to an item, category, account, and import batch.
- `transaction_import_batches`: user-owned import metadata and authoritative row counts; stores no original file contents.
- Composite `(parent_id, user_id)` foreign keys prevent cross-owner child records.
- Category triggers verify owner and item type.
- Money is `numeric(14,2)` and constrained to `0..999999999999.99`.
- Transaction amounts are non-negative `bigint` minor units. Refunds and income reversals use `is_refund`; pending and void entries are retained but excluded from actual totals and account balances.
- Account balances are derived by `retrieve_financial_accounts(boolean)` from opening balance plus posted transaction effects; no duplicate balance column is stored.

## Transactional functions

`create_month_from_template(date, uuid)` derives ownership from `auth.uid()`, validates the template, inserts the unique month, copies active items, and returns the existing row on conflicts. Concurrent tabs converge on one month.

`setup_first_budget(...)` serializes per user with an advisory transaction lock and creates/updates the profile, preferences, default categories, default template, initial items, onboarding timestamp, and current month in one database transaction.

`set_default_template(uuid)` serializes the switch and respects the partial unique index.

`delete_own_account()` derives `auth.uid()` and deletes only that Auth user; cascading foreign keys remove owned data. Test this in staging and confirm backup/retention policy before enabling production use.

`create_budget_transaction(...)`, `update_budget_transaction(...)`, and `delete_budget_transaction(uuid)` derive ownership from `auth.uid()`. Composite foreign keys and validation triggers keep month, item, category, account, type, currency, and transaction date aligned. The historical-month trigger calls the same profile-timezone-aware lock as budget item mutations.

`create_financial_account(...)` and `update_financial_account(...)` own account mutations. Direct account and transaction table writes are not granted to authenticated clients; authenticated users receive RLS-scoped reads and the explicit RPC operations only.

`import_budget_transactions(...)` accepts at most 2,000 already-normalized rows, checks ownership, account currency, mapping metadata, month dates, minor-unit limits, and stable fingerprints before any insert. An advisory lock and active batch-key unique index make retries idempotent; the transaction unique index prevents duplicates across different batches. `undo_transaction_import_batch(uuid)` deletes only that owned batch's imported rows and refuses locked months. Direct import-batch writes are denied.

All security-definer functions use `search_path = ''`, qualify objects, reject unauthenticated access, accept no caller-supplied owner ID, revoke public/anonymous execution, and grant only the intended authenticated operation.

## Auth configuration

Hosted projects should require email confirmation. Set access-token expiry to a short operationally reasonable value (the local config uses 3600 seconds), enable rotating refresh tokens, configure the site URL, and add the exact callback/reset URLs from the README.

For custom SMTP, store hostname, username, password, sender address, and provider API credentials only in Supabase/provider configuration. Verify registration and recovery mail on staging before production.

## RLS tests

`supabase/tests/0001_rls_and_snapshots.test.sql` creates Alice and Bob inside a rolled-back transaction. It verifies read/update/delete/insert isolation, anonymous denial, cross-parent denial, function ownership, idempotent creation, copied item counts, historical snapshot integrity, and one-default uniqueness.

Treat `npm run test:db` as release-blocking. CI starts an isolated Supabase stack and runs it.

The PKCE and password flow choices follow the current [Supabase PKCE guide](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and [password authentication guide](https://supabase.com/docs/guides/auth/passwords). Re-check these before changing the Auth client or email templates because provider behavior can evolve.

## Backup and recovery

The owner must choose provider backup/PITR retention appropriate to the data and plan, restrict restore access, and run periodic restore drills in a non-production project. Record RPO/RTO, escalation contacts, and the last successful drill. JSON user exports are not a replacement for database backups.

User JSON exports use schema version 4. They include financial accounts, import-batch metadata, each selected month's transaction ledger, and a derived `planned_versus_actual` summary. Any future restore implementation must ignore and recompute that summary, validate batch/transaction ownership and fingerprints, integer minor-unit bounds, composite references, and historical locks, and never treat mapping metadata as original statement content; no restore path currently writes this export back into the database.
