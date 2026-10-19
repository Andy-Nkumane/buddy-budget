# Registration transparency and authorised tester access

Reviewed on 17 October 2026. This is a technical control record, not legal approval or a claim of POPIA compliance.

## Collection notices

Concise notices appear before information is entered during registration, onboarding, CSV selection, transaction entry, account creation, schedule entry, goal entry, and one-off monthly-plan entry. Each notice links to the draft Privacy Policy and Terms of Use and identifies the relevant information, destination, and minimisation warning.

Registration requires an unchecked acknowledgement of the testing Terms and that the Privacy notice was read. The acknowledgement is described separately from optional consent and marketing. Buddy Budget does not request marketing consent during registration. The acknowledgement version and timestamp are included in Supabase Auth user metadata for operational diagnostics; user metadata is not treated as immutable legal evidence.

The Terms and Privacy Policy remain draft-blocked. An acknowledgement does not cure missing operator details, lawful-ground decisions, age rules, or legal approval.

## Server-enforced tester gate

Migration `202610170001_add_tester_signup_allowlist.sql` adds a private email allowlist and a `before-user-created` Supabase Auth hook. The hook rejects absent, expired, and unknown email addresses, as well as requests missing the required notice acknowledgement metadata, before Auth creates a user. Browser roles cannot read the allowlist or execute the hook.

The client notice is not an access control. A hosted deployment remains blocked until an operator:

1. applies the migration;
2. inserts only approved, lower-case tester email addresses into `buddy_budget_private.tester_signup_allowlist`, with a reviewed expiry;
3. enables `public.authorize_tester_signup` under Authentication > Hooks > Before User Created;
4. keeps anonymous sign-ins disabled and email confirmation enabled;
5. verifies an allowlisted signup succeeds and a non-allowlisted signup is rejected; and
6. records the tester approver, approval basis, expiry, revocation procedure, and test evidence without placing secrets in the repository.

Expired entries stop authorising signup immediately but are not automatically erased. The operator must periodically delete expired entries under the approved retention procedure; that procedure remains part of `COMP-003`.

Local Supabase enables the hook in `supabase/config.toml`. Hosted hook selection is dashboard configuration and cannot be proven from this repository. If the hook is unavailable or unverified, disable **Allow new users to sign up** in Supabase Auth; existing users can still sign in. Do not deploy public self-registration based only on hidden buttons, route guards, or `VITE_` variables.

## How the Before User Created hook works

Supabase Auth calls `public.authorize_tester_signup` after receiving a signup request but before inserting the new row into `auth.users`. The function permits creation only when all of the following are true:

- the request contains an email address;
- the normalised email has an unexpired row in `buddy_budget_private.tester_signup_allowlist`; and
- the request contains the required Terms acknowledgement and Privacy notice versions.

If any check fails, the function returns the same generic `403` authorised-testers response and Auth does not create the user. The hook controls new account creation only. It does not run during normal sign-in, and removing an email from the allowlist does not suspend or delete an account that has already been created.

## Configure the hosted hook

For each Supabase project separately:

1. Apply migration `202610170001_add_tester_signup_allowlist.sql` with the normal reviewed migration process.
2. Open **Authentication > Hooks > Before User Created** in the Supabase Dashboard.
3. Select the Postgres function `public.authorize_tester_signup` and save the configuration.
4. Add approved tester emails using the SQL Editor as described below.
5. Confirm email verification is enabled and anonymous sign-ins are disabled.
6. Test an approved and an unapproved address before enabling the deployed registration route.

The local stack reads the equivalent hook setting from `supabase/config.toml`. Configuring staging does not configure production, and `supabase db push` applies the database objects but does not prove that the hosted Auth hook is selected.

## Manage approved tester emails

Run these statements only from a trusted operator session such as the Supabase SQL Editor. Browser roles cannot access this table.

Add one tester for 30 days:

```sql
insert into buddy_budget_private.tester_signup_allowlist (email, expires_at)
values (lower('tester@example.com'), now() + interval '30 days');
```

Add several testers with the same expiry:

```sql
insert into buddy_budget_private.tester_signup_allowlist (email, expires_at)
values
  (lower('first@example.com'), now() + interval '30 days'),
  (lower('second@example.com'), now() + interval '30 days');
```

List entries and their current status:

```sql
select
  email,
  created_at,
  expires_at,
  expires_at > now() as active
from buddy_budget_private.tester_signup_allowlist
order by expires_at;
```

Extend an approval for another 30 days:

```sql
update buddy_budget_private.tester_signup_allowlist
set expires_at = now() + interval '30 days'
where email = lower('tester@example.com');
```

Revoke permission to create a future account:

```sql
delete from buddy_budget_private.tester_signup_allowlist
where email = lower('tester@example.com');
```

Delete expired entries during the approved retention process:

```sql
delete from buddy_budget_private.tester_signup_allowlist
where expires_at <= now();
```

Email matching is case-insensitive because entries and signup values are normalised to lower case. An expiry must be later than the row creation time. Adding an email does not send an invitation; the approved tester must still use the normal registration form and complete email verification.

## Verification checklist

- An active allowlisted email with the required acknowledgement can register and creates exactly one Auth user.
- An unknown or expired email receives the generic authorised-testers error and creates no Auth user.
- A request missing the required acknowledgement is rejected even when its email is allowlisted.
- Removing an allowlist entry prevents a new registration attempt but does not revoke an existing account or session.
- No allowlist contents are readable through the anonymous or authenticated browser API.

If the hosted hook cannot be verified, disable **Allow new users to sign up** until the configuration is corrected.

## Separate access-control follow-up

A future PR may add a managed invitation workflow with one-time admission codes, time-limited approvals, revocation controls, and evidence export. It must retain the server-side Auth hook boundary and must not expose the tester list to browser roles.

## Official implementation references

- [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)
