# Supabase security and data-isolation hardening

Audit date: 15 October 2026  
Migration: `202610150001_harden_database_privileges.sql`

## Confirmed repository findings

- **CONFIRMED P0:** the effective local catalog granted `authenticated` the `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges on several public tables. PostgreSQL RLS does not restrict `TRUNCATE`, so these privileges were unnecessary and unsafe.
- **CONFIRMED P0:** the effective local catalog allowed `anon` to execute multiple public-schema functions, including `SECURITY DEFINER` functions and trigger helpers. Existing function bodies often rejected missing `auth.uid()`, but every callable definer unnecessarily enlarged the anonymous attack surface.
- **CONFIRMED:** all 42 public tables had RLS enabled and all 106 public functions that used `SECURITY DEFINER` fixed `search_path` to an empty value.
- **CONFIRMED:** no committed production secret, database password, Mailjet credential, or service-role key was found. Vite reads only the project URL and browser-safe publishable key; privileged keys are read only by Edge Functions.

## Remediation

The migration removes every table privilege from `anon` and `authenticated`, then grants only the table operations already required by the application. It removes anonymous execution from every public-schema function, removes direct authenticated execution from trigger/server-only helpers, and changes default privileges so future tables and functions do not inherit browser-role access implicitly.

The migration does not change RLS policy meaning, household roles, application calculations, or the service-role permissions required by Edge Functions.

## Production configuration requiring owner verification

The repository cannot prove hosted-project settings. Before deployment, capture dated evidence for each item without copying secrets into the repository:

1. Authentication signup is disabled or limited to the approved tester admission process; email confirmation is enabled.
2. Site URL and redirect allowlist contain only exact approved production/staging URLs and necessary localhost development URLs are absent from production.
3. Leaked-password protection, CAPTCHA/rate limits, refresh-token rotation, password policy, MFA policy and session duration match the approved risk decision.
4. The API exposes only required schemas; RLS is enabled on every exposed table; the Database Linter has no unresolved security findings.
5. Migration `202610150001` is present in production migration history and catalog queries confirm no `anon` table/function privileges and no browser-role `TRUNCATE` privileges.
6. `share-report` is the only intentionally unauthenticated Edge Function. Its public actions remain token-scoped, while authenticated actions validate the caller JWT inside the function.
7. Service-role, database, Mailjet and Cron/Vault secrets exist only in Supabase secrets or an approved secret manager; rotation dates and owners are recorded.
8. Network restrictions, SSL enforcement, project access roles, log retention, backups/PITR, restore testing and incident contacts match approved owner decisions.
9. Production and staging are separate projects. Disposable test accounts—not production identities or financial data—are used for isolation checks.

## Verification queries

Run through a privileged, audited SQL session after applying the migration:

```sql
select *
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon';

select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

select procedure.oid::regprocedure
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and has_function_privilege('anon', procedure.oid, 'execute');
```

All three queries must return zero rows.

## Rollback considerations

The hardening is privilege-only and does not rewrite data. If an application operation fails after deployment, identify the exact missing table/function privilege and add the narrow grant in a new forward migration. Do not restore broad `ALL`, `TRUNCATE`, anonymous function execution, or edit an applied migration. Rolling back all restrictions would recreate the confirmed security defects.
