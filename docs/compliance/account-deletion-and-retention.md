# Account deletion and retention

Reviewed on 18 October 2026. This is an evidence-based technical control record, not legal advice or proof of deletion from a deployed provider.

## Verified deletion path

1. An authenticated user opens **Settings > Account**, reviews the limitations, types `DELETE`, and submits once.
2. The browser calls `delete_own_account()` without accepting a user ID from the client.
3. PostgreSQL derives the user from `auth.uid()`. An unauthenticated caller is rejected.
4. An owner or original data owner is blocked while their household has another member. They must transfer ownership and remove or relocate members so shared data is not orphaned.
5. For an eligible account, the same database transaction removes its memberships, sole-owned households, Auth identity, and rows connected through foreign-key cascades.
6. Only after the RPC succeeds does the browser perform local-only session cleanup. Query caches, the active-household key, the user's resumable-onboarding draft, cross-tab month signals, and pending milestone state are cleared.

The database transaction is authoritative. If it fails, the UI keeps the session and displays the server error. If database deletion succeeds but browser cleanup fails, the UI says the account was deleted, disables repeat submission, and tells the tester to close the application and clear site data. It does not misreport local cleanup failure as failed server deletion.

## Data handling by location

| Location                         | Verified behavior                                                                                                                                                                                                         | Limitation or dependency                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth                    | `auth.users` row is deleted by the authenticated security-definer RPC                                                                                                                                                     | Hosted Auth logs and provider backups were not available for inspection                                                                                     |
| Primary PostgreSQL tables        | Account-owned rows and sole-owned household data cascade in the same transaction; local pgTAP verifies representative identity, profile, household, check-in, delivery, milestone, locked-report, and transaction records | A complete deployed inventory must be rechecked after every schema change                                                                                   |
| Shared households                | Deletion is blocked while an owned/data-owned household has other members; deleting a non-owner removes their membership while preserving the other household                                                             | Activity actor IDs can be set to `null`; the approved audit-history retention rule is pending                                                               |
| Public shares and adviser access | Rows tied to the deleted creator, adviser, grantor, or deleted household use configured cascades                                                                                                                          | Already downloaded reports, PDFs, JSON/CSV files, copied templates, or recipient-held content cannot be recalled                                            |
| Browser and PWA                  | Account query cache and account-scoped storage are cleared after deletion; static PWA assets and explicitly approved fictional/public starter-plan state are not account records                                          | If storage APIs fail, the tester must clear site data manually; another device must clear its own local state                                               |
| Mailjet                          | Future weekly delivery stops because preferences and queued delivery records cascade                                                                                                                                      | Mailjet message, suppression, bounce, security, and operational-log retention is controlled by Mailjet/deployment configuration and is unverified           |
| Supabase/GitHub/hosting logs     | No application deletion code claims to erase provider logs                                                                                                                                                                | Access, security, billing, and platform logs require provider-contract and retention review                                                                 |
| Backups and PITR                 | Primary rows become absent from the live database                                                                                                                                                                         | Deletion from backups is not immediate; plan capability, retention, restore controls, and re-deletion after restore require an approved operating procedure |

## Retention decisions

No record-by-record retention period, legal hold, backup erasure period, provider-log period, or audit-history anonymisation rule is approved in repository evidence. `OD-008`, `OD-013`, `OD-014`, and `OD-015` therefore remain owner decisions. The owner and legal reviewer must record, for each data class:

- purpose and lawful basis;
- retention trigger and period;
- deletion, anonymisation, or justified preservation method;
- legal hold and dispute rules;
- backup/PITR expiry and restore re-deletion procedure;
- provider responsibility and evidence source; and
- accountable owner and review date.

Account deletion must not silently remove records that a reviewed legal obligation requires the operator to preserve. Conversely, an undefined possible legal obligation is not authority for indefinite retention.

## Local verification

Use disposable local accounts only:

1. Create an owner and another member. Confirm owner deletion is blocked and the Auth identity remains.
2. Remove or relocate the other member, then delete the owner. Confirm the Auth identity, profile, household, and representative personal/domain rows are absent.
3. Confirm the other account and its household remain unchanged.
4. Attempt unauthenticated deletion and confirm PostgreSQL rejects it.
5. Simulate an RPC failure and confirm the UI does not clear the session or claim success.
6. Simulate local-session cleanup failure after RPC success and confirm the UI reports partial cleanup accurately and prevents resubmission.
7. Inspect browser storage and the query cache after successful deletion.
8. In staging, separately verify configured Supabase backup/PITR, Auth/audit logs, Mailjet retention/suppression behavior, and restoration re-deletion. Do not use production identities for this test.

## Operational owner actions

- Approve the retention schedule and any lawful preservation exceptions.
- Record Supabase and Mailjet contract/configuration evidence rather than inferring it from application code.
- Assign a recovery owner and procedure that reapplies valid deletion requests after a backup restore.
- Add every future user-owned table to the deletion regression inventory.
- Provide the verified privacy request channel required by `COMP-006` for deletion requests the self-service path cannot resolve.
