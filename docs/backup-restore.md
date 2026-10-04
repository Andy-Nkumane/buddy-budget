# Backup restoration and recovery

Buddy Budget JSON backups use schema version 10. Version 9 files are upgraded locally by a forward migration hook; older or future versions are rejected. The browser validates structure, identifiers, exact minor-unit values, record count (10,000 maximum), and file size (10 MB maximum) before sending structured JSON.

## Merge

Merge matches categories by type/name, accounts by name/currency, templates and goals by name, schedules by name/start date, rules by order, and months by calendar month. Missing roots are inserted with new server-generated IDs. When a month or template already exists, its children are skipped: merge never rewrites an existing month, including locked history. Retrying the same fingerprint and mode returns the original report.

## Full replacement

Replacement requires the exact phrase `REPLACE MY DATA`, a password re-authentication, and a JWT issued within ten minutes. The RPC creates a server-side recovery snapshot before deleting domain records. Deletion and restoration occur in one transaction; any validation, constraint, or relationship failure rolls everything back, including the snapshot and restore run.

The restore RPC uses a private transaction marker to pass immutable-history triggers. Browser roles cannot create that marker. Source ownership IDs, authentication data, notification delivery logs, provider identifiers, and secrets are rejected or stripped. Every imported row receives the authenticated user's ID and every relationship uses a server-side source-to-target ID map.

## Recovery procedure

1. Record the recovery snapshot ID from the downloaded restore report.
2. Confirm the user is recently authenticated and has typed `REPLACE MY DATA`.
3. An operator or future recovery UI may call `rollback_backup_restore(snapshot_id, 'REPLACE MY DATA')` as that user. The rollback itself creates another recovery snapshot.
4. Download the resulting report and verify record counts, oldest/newest month, currencies, locked reports, transactions, schedules, goals, and adjustments.
5. Keep provider PITR/database backups as the primary disaster-recovery system. User JSON snapshots are portability and account-level recovery tools, not a substitute for provider backups.

Run recovery drills only with disposable accounts or a non-production project. Never test full replacement against a real user account.
