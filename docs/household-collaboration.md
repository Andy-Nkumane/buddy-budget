# Household collaboration

Each account receives a private initial household. Existing records are adopted in place: their `user_id` remains the immutable legacy data-owner key while `household_id` becomes the authorization boundary. No financial record is copied during migration.

## Permission matrix

| Capability                              | Owner          | Editor | Viewer |
| --------------------------------------- | -------------- | ------ | ------ |
| Read household financial data           | Yes            | Yes    | Yes    |
| Create and edit financial records       | Yes            | Yes    | No     |
| Read activity history                   | Yes            | Yes    | Yes    |
| Invite, revoke, remove, or change roles | Yes            | No     | No     |
| Transfer household ownership            | Yes            | No     | No     |
| Restore or roll back a backup           | Yes            | No     | No     |
| Leave household                         | After transfer | Yes    | Yes    |

PostgreSQL enforces the matrix through `has_household_role`; UI controls are explanatory rather than the security boundary. Membership is checked on every statement, so removal takes effect on the next request.

## Invitations

Invitation tokens contain 256 bits of randomness. PostgreSQL stores only a SHA-256 digest. A token expires after seven days, can be accepted or declined once, and requires an authenticated user whose confirmed email exactly matches the normalized recipient address. Creating a newer invitation revokes an older pending invitation for the same household and email.

Buddy Budget displays the link once for the owner to send through a trusted channel. The raw token is never stored in a readable table.

## Switching and cache isolation

The selected household is persisted in the member's profile. Browser query keys contain the active household ID. Before a switch, all active requests are cancelled and the complete query cache is cleared; only then is the new household selected and its context fetched. Signing out or changing users also removes the local household scope.

## Accountability and lifecycle

Material inserts, updates, and deletes append an activity entry containing the actor, entity type, record ID, action, and timestamp. Financial values are not copied into the activity log. RLS allows members to read the log but never update or delete it.

An owner cannot leave or remove the last owner. Ownership transfer is atomic. Account deletion is rejected while an owned or legacy-data household still contains another member; the user must transfer responsibility and resolve membership first.

JSON exports contain the active household's portable financial domain only. User IDs, household IDs, memberships, invitation tokens and hashes, and the activity log are excluded. Restore and recovery rollback are owner-only and append one summarized activity event instead of logging every restored row.

## Operational checks

1. Confirm every existing user owns an initial household and all existing domain rows have its `household_id`.
2. Invite disposable editor and viewer accounts using verified email addresses.
3. Confirm the editor can update a current month and the viewer cannot perform the same write.
4. Remove the viewer and confirm the next request cannot read the household.
5. Switch between two households and confirm no previous household values flash on screen.
6. Export and restore as an owner; confirm editors and viewers cannot restore.
