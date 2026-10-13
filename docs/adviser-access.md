# Time-limited adviser access

Household owners can create an adviser invitation from the Household page. The default grant lasts seven days, starts immediately, exposes only monthly summaries, and does not allow export. Owners must explicitly select a date range and add categories, transaction details, schedules, goals, or scoped JSON export.

The adviser signs in with their own verified account and accepts a single-purpose invitation. Acceptance does not create a household membership and does not change the adviser's active household. Adviser mode is a separate route and cache boundary that uses only `retrieve_adviser_grants()` and `retrieve_adviser_data(uuid)`.

## Enforcement

- Grant and audit tables have RLS enabled and no direct browser table privileges. Sanitized security-definer RPCs are the only access path.
- The read RPC checks the authenticated adviser, acceptance, start time, expiry, revocation, date range, approved sections, and the grantor's continuing owner membership on every request.
- Advisers receive no ordinary household RLS role. Existing table writes and mutation RPCs therefore cannot target the granted household.
- Invitation tokens contain 256 bits of randomness; only their SHA-256 hashes are stored.
- Revocation and grantor membership removal invalidate the next request. Renewal creates a new grant and invitation rather than extending an already accepted authority silently.
- Access events are append-only and recorded at most once per adviser per grant per UTC day. Owners see the actor, action, and timestamp without recording viewed rows or financial values.
- Export is absent by default. When enabled, it downloads only the already approved RPC response. Adviser mode provides no sharing controls.

Grant records, invitation hashes, and access events are operational authorization data and are excluded from portable JSON backups. They are removed when their household is deleted.

## Manual verification

Use two disposable verified accounts. Create a summary-only grant, accept it as the adviser, confirm adviser mode shows the banner and approved month range, and verify no editing or export controls exist. Then test a future start, expiry, revocation, renewal, grantor membership removal, transaction scope, export opt-in, mobile layout, and sign-out. Direct REST access to household tables must return no granted data.
