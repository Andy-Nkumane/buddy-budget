# CSV, browser storage, and PWA privacy

Reviewed on 18 October 2026. This record describes repository controls; it does not prove a particular browser, hosted environment, or provider configuration.

## Storage inventory

| Store                         | Content                                                                                                                                  | Persistence and cleanup                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React/TanStack Query memory   | Authenticated profiles, household context, financial records, CSV parse/preview state                                                    | Not persisted by a query persister. Cleared when the authenticated user changes or signs out. CSV file, raw table, preview, and rule context are released when replacing the statement or closing the flow. |
| Supabase Auth browser storage | Session and refresh material managed by Supabase Auth                                                                                    | `persistSession` and automatic refresh remain enabled. Application cleanup does not enumerate or delete Supabase-managed keys; local or global Supabase sign-out owns session removal.                      |
| `localStorage`                | Active-household ID, user-keyed resumable onboarding draft, non-sensitive month-change timestamps, approved demo/calculator starter plan | Account-scoped keys are cleared on logout/deletion. The public starter plan is deliberately preserved, expires after 24 hours, contains no transactions, and is consumed after successful onboarding.       |
| `sessionStorage`              | Pending one-time milestone, install-prompt dismissal, anonymous shared-template continuation token                                       | The user milestone is cleared on logout/deletion. Install UI preference and public continuation state are not authenticated financial records.                                                              |
| Cache Storage/service worker  | Versioned static HTML, JavaScript, CSS, fonts, SVG, and public application icons                                                         | No runtime caching is configured. JSON, CSV, PDF, API responses, and user-generated financial data are outside the precache patterns. Old application caches are cleaned during service-worker updates.     |
| IndexedDB                     | No application-owned IndexedDB database found                                                                                            | Browser or Supabase internals remain browser/vendor behavior and require deployed-browser inspection.                                                                                                       |
| Downloads                     | User-requested JSON, CSV, PDF, restore report, or scoped adviser export                                                                  | Generated in memory and downloaded with a short-lived blob URL. The user controls the resulting device file; logout or deletion cannot recall it.                                                           |

## CSV boundary

The raw UTF-8 statement is read with `File.arrayBuffer()` and decoded in the browser. The file is bounded to 2 MiB, 2,000 data rows, and 100 columns. Raw rows remain in component memory only for mapping and preview; they are not written to `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, logs, or the query cache.

Only explicitly included normalized fields are submitted: transaction date, description, integer minor-unit amount, transaction type, optional external reference, fingerprint, selected mapping metadata, counts, and the file name. Unmapped columns and original file bytes are not sent. Tests include an unused account-number column and verify that it is absent from the repository request.

## Network and cache boundary

- The generated service worker precaches only the public application shell and has no runtime cache routes.
- Supabase REST, Auth, Edge Function, Storage, and export-like paths are denied the navigation fallback.
- The Supabase client uses a custom fetch wrapper with `cache: 'no-store'`, preventing authenticated responses from entering the browser HTTP cache while preserving headers, abort signals, session persistence, and token refresh.
- Edge Functions returning check-in or public-share content already send `Cache-Control: no-store`; the share endpoint also uses private/no-cache and referrer protections.
- No application logging of CSV rows, financial query results, authorization headers, or export bodies was found. Edge error logging remains generic.

## Logout and deletion

Logout or deletion clears in-memory queries and these account-scoped application keys:

- selected household;
- the signed-in user's onboarding draft;
- cross-tab month-change signals; and
- pending milestone state.

Cleanup intentionally does not call `localStorage.clear()`, `sessionStorage.clear()`, `caches.delete()`, or IndexedDB deletion. Broad origin cleanup would interfere with Supabase session lifecycle, anonymous conversion continuity, install preferences, and the public offline application shell. If browser storage APIs fail, the account-deletion flow tells the tester to close the application and clear site data manually.

## Verification

1. Import a disposable CSV containing an unmapped sentinel column and inspect the Supabase RPC request; confirm the sentinel and raw file bytes are absent.
2. Choose another statement and confirm the previous raw preview is no longer rendered or retained by component state.
3. Inspect Application > Storage: confirm no application IndexedDB and no raw CSV data in local/session storage.
4. Build the PWA and inspect the generated precache manifest: confirm only static shell assets and public icons are listed.
5. While authenticated, inspect Supabase requests and confirm `Cache-Control` behavior plus `cache: no-store`; verify Cache Storage receives no REST/Auth/Function response.
6. Sign out and confirm private query data and account-scoped keys disappear while the public shell still loads offline after it was installed online.
7. Sign back in and confirm Supabase refresh/session behavior still works.

## Remaining owner checks

- Verify actual production response headers and browser cache behavior in each supported browser.
- Define shared-device guidance and whether managed tester devices require additional browser policy.
- Confirm hosting/CDN configuration does not override private API or Edge Function cache headers.
- Recheck this inventory whenever storage, analytics, offline financial editing, uploads, or a query persister is introduced.
