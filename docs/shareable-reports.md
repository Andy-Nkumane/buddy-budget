# Privacy-safe shared reports

Buddy Budget owners can create a deliberately limited, immutable report snapshot from **Settings → Your data → Share limited report**. Editors and viewers cannot create or revoke shared links.

## Privacy model

- Totals and category aggregates are enabled by default. Transactions, names, notes, and goals are off by default.
- The preview is the exact payload sent to the server. The Edge Function validates and reconstructs the approved schema, discarding unknown fields.
- A cryptographically random 256-bit token is returned once. PostgreSQL stores only its SHA-256 hash.
- The token is placed after `#` in the shared URL, so it is not sent in page requests, referrer headers, or ordinary hosting logs.
- Shared snapshots are immutable and disconnected from the underlying budget. Later edits never change an existing share.
- Anonymous clients have no table privileges. The public Edge action can only atomically consume one matching, active snapshot.
- Responses use `no-store`, `no-referrer`, `nosniff`, frame denial, and a restrictive content security policy. The page sets `noindex`, `nofollow`, and `noarchive`.
- Errors and link previews contain no financial values and do not distinguish an invalid token from an expired, revoked, code-protected, or view-limited share.

## Controls

Links expire after 24 hours, 7 days, 30 days, or 90 days. Owners may add a 6–12 digit access code, set a view limit, or revoke a link immediately. Access-code hashes are bound to the secret token. The printable view and generated PDF use only fields already present in the snapshot.

## Deployment

Deploy migration `202610100001_add_shared_budget_reports.sql`, then deploy the function with `supabase functions deploy share-report --no-verify-jwt`. JWT verification is deliberately handled inside the function because public viewing has no user token; create, list, and revoke actions still validate the user and require the active household owner role.

No new environment secret is required beyond the standard Edge Function `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values supplied by Supabase.
