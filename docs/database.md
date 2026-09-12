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
- Composite `(parent_id, user_id)` foreign keys prevent cross-owner child records.
- Category triggers verify owner and item type.
- Money is `numeric(14,2)` and constrained to `0..999999999999.99`.

## Transactional functions

`create_month_from_template(date, uuid)` derives ownership from `auth.uid()`, validates the template, inserts the unique month, copies active items, and returns the existing row on conflicts. Concurrent tabs converge on one month.

`setup_first_budget(...)` serializes per user with an advisory transaction lock and creates/updates the profile, preferences, default categories, default template, initial items, onboarding timestamp, and current month in one database transaction.

`set_default_template(uuid)` serializes the switch and respects the partial unique index.

`delete_own_account()` derives `auth.uid()` and deletes only that Auth user; cascading foreign keys remove owned data. Test this in staging and confirm backup/retention policy before enabling production use.

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
