# Copyable template links

Household owners can publish an immutable, versioned snapshot from **Templates → Share template**. The preview shows the exact structure recipients receive. Names, categories, item types, and ordering are included; planned amounts are excluded unless the owner explicitly enables them after seeing the privacy warning.

Transactions, notes, goals, profile details, household members, and historical months are never read into the snapshot. Copied templates receive new household ownership, category, template, and item records. Source ownership identifiers are not copied.

## Link lifecycle

- A 256-bit random token is returned once in the URL fragment. PostgreSQL stores only its SHA-256 hash.
- Links expire after 24 hours, 7 days, 30 days, or 90 days and can be revoked immediately by the owner.
- Revocation prevents future previews and copies. Templates already copied into another household remain independent.
- Anonymous previews are rate-limited per link and visitor fingerprint. Responses disable caching, referrers, framing, MIME sniffing, and indexing.
- The recipient may rename the template, rename or exclude items, change categories, and set amounts before copying.
- A copy key makes a submission retry idempotent. PostgreSQL validates every item against the published snapshot and creates the owned graph transactionally.

Anonymous recipients may continue through registration or sign-in. Only the opaque link token is kept in session storage for that browser tab; the template is fetched again after authentication and copied only after explicit confirmation.

## Deployment and verification

Apply `202610120001_add_shared_template_links.sql`, deploy the existing `share-report` Edge Function with `--no-verify-jwt`, and verify `/template#<token>` is handled by the GitHub Pages fallback. No additional secret is required beyond the Edge Function's standard `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Before release, publish one link without amounts and confirm the response contains no `amount` keys. Then test an amount-enabled link, anonymous continuation, customization, a repeated copy submission, expiry, revocation, owner/editor/viewer permissions, and cross-household isolation.

Shared-link records, rate-limit counters, and copy diagnostics are operational security data and are not included in JSON backups. A copied template is an ordinary owned template and is included normally.
