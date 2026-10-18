# Data access, export, and correction

Reviewed on 17 October 2026. This is an evidence-based technical control record, not legal advice, legal approval, or a complete POPIA/PAIA procedure.

## Self-service routes

Authenticated users can use **Settings > Your data** to create an export. The export is scoped to the currently selected household by PostgreSQL row-level security. A user must switch households and create a separate export for each shared budget they are permitted to read.

Users can correct editable information through the relevant application screen:

- personal display name, currency presentation, locale, timezone, and theme in Settings;
- current financial records through budget, transaction, account, template, category, cash-flow, and goal screens, subject to the household role matrix; and
- a legitimately late issue concerning an age-locked month through a current editable month's adjustment workflow.

Owners and editors can correct editable household financial records. Viewers can read and export the selected household but cannot change financial records. Automatic historical locks, closed-month rules, append-only activity, and immutable close snapshots remain authoritative: a correction must not rewrite locked history.

## Export coverage

| Format | Intended use                                      | Included                                                                                                                                                                                                                                                                                                           | Important exclusions or limits                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON   | Portable backup and restoration                   | Personal profile/display preferences; selected-household categories, accounts, templates/items, months/items/transactions, import metadata, categorisation rules/dismissals, schedules/occurrences, goals/contributions/recommendations, check-in preferences, lifecycle records, close summaries, and adjustments | Auth credentials and Auth-provider records; household memberships/invitations/activity; adviser grants/access events; shared-link snapshots and access logs; notification deliveries; activation milestones; provider credentials/logs; infrastructure backups |
| CSV    | Spreadsheet analysis for the chosen month range   | Month summaries, planned items, transactions, close summaries, adjustments, goal recommendations/contributions, and optional forecast occurrences                                                                                                                                                                  | Not a restorable backup; no profile, authentication, household administration, or operational logs                                                                                                                                                             |
| PDF    | Human-readable budget report for the chosen range | Budget totals/items/transactions, adjustments and adjusted interpretation, goal information, with optional forecasts and insights                                                                                                                                                                                  | Presentation report only; not a complete record export or restorable backup                                                                                                                                                                                    |

JSON ownership identifiers are removed before download. This makes the file portable; it does not weaken server-side ownership checks or transfer source ownership when restoring. Date-range filtering limits month-linked records, while reusable categories, accounts, templates, schedules, goals, rules, personal display settings, and preferences remain in the portable backup so relational restoration remains possible.

Self-service export is an optional portability facility. It must not be represented as automatically satisfying every legal access request because it deliberately omits authentication, membership, security, delivery, provider, and operational records.

## Ownership and isolation evidence

- `exportAllData` and `retrieveMonthsForExport` query through the authenticated Supabase client; they do not accept a user or household identifier from the browser.
- Household-scoped RLS permits reads only for the active household and a current owner, editor, or viewer membership.
- JSON export captures the active household before querying, rejects any returned household-owned record outside that scope, and aborts if the active household changes before completion.
- Profile and preference reads bind to the authenticated user ID.
- Portable export removes `user_id`, `household_id`, and `active_household_id` recursively.
- Cross-household selection and forged ownership are covered by pgTAP security and household tests.
- Restore separately remaps source IDs and rechecks ownership; an export file does not grant access to its source household.

## Requests outside self service

The Privacy Policy describes potential access, correction, deletion, objection, and complaint rights. The Contact page currently directs authorised testers to the verified channel through which their test invitation was issued. Do not send passwords, access links, identity documents, bank statements, exports, or detailed financial information to an unverified address.

This interim route is not a complete rights-request operation. The accountable owner must still approve and publish a monitored privacy/PAIA channel, identity-verification method, request register, response ownership and timing, refusal/appeal handling, correction annotations for disputed immutable records, backup/log handling, and complaint escalation (`OD-009`, `OD-018`, `COMP-006`, and `COMP-011`). Those unresolved governance controls are not invented in runtime code.

## Verification

1. In a disposable owner account with two households, create distinct records in each household.
2. Export each household separately and confirm neither file contains the other household's records or ownership IDs.
3. Confirm an editor can correct a current transaction and a viewer cannot mutate the same record through either UI or direct API/RPC access.
4. Confirm an outsider cannot select or export household records even when supplying known record IDs.
5. Confirm editing a locked transaction fails and a current-month adjustment leaves the original locked month and transaction byte-for-byte unchanged.
6. Confirm CSV/PDF totals still match the on-screen planned-versus-actual calculations for the same range.
7. Inspect browser/network logs and errors and confirm no export body or detailed financial values were logged.
