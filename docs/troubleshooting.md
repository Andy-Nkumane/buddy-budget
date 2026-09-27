# Troubleshooting

## “Connect BuddyBudget to Supabase” appears

Copy `.env.example` to `.env.local`, set a valid API URL and browser-safe publishable/anon key, then restart Vite. Never substitute the secret/service-role key.

## Supabase does not start locally

Run `docker version` and confirm the daemon is active. Check ports 54320–54323, stop stale local projects with `npx supabase stop`, then retry `npx supabase start`. Corporate proxies may block image downloads.

## Email confirmation or password reset is rejected

Compare the browser URL exactly with Supabase Dashboard → Authentication → URL Configuration. For project Pages, the repository segment must be present:

```text
https://<owner>.github.io/<repo>/auth/callback
https://<owner>.github.io/<repo>/auth/reset-password
```

PKCE links must normally be completed on the same browser/device where the flow started. Codes are single-use and short-lived; request a new email after a failed/expired attempt.

## Direct GitHub Pages refresh shows 404

Confirm `dist/404.html` exists, `VITE_BASE_PATH` was `/<repo>/`, Pages deploys the complete `dist` artifact, and the custom workflow is selected. Clear a stale service worker after changing the base. Custom root domains must build with `/`.

## App assets or shortcuts lose the repository path

Inspect `dist/manifest.webmanifest`. Every `start_url`, `scope`, icon, screenshot, and shortcut must start with the configured base. Do not omit the leading/trailing slash from `/repo/`.

## Budget edit remains “Not saved”

Check connectivity and Supabase status, preserve the draft in the field, reconnect, then choose Retry. Validation rejects negatives, more than two decimals, and values above `999,999,999,999.99`. Do not refresh until the draft is saved or intentionally discarded.

## Current month is missing

Confirm an active default template exists. Opening the current route invokes the idempotent database function once; past/future months require **Create this month**. If creation fails, inspect the safe UI error and Supabase logs—never log session tokens.

## Database/RLS tests fail

Run `npx supabase db reset`, then `npm run test:db`. Ensure tests target local Docker, not hosted production. A cross-user test unexpectedly succeeding is release-blocking.

## Installed app looks stale

Finish pending edits, use the in-app Update action, or close/reopen all app windows. For development only, inspect Application → Service Workers/Cache Storage and unregister/clear site data, then reinstall.

## CSP blocks Supabase

The project must use an HTTPS `*.supabase.co` URL or the documented local origin. If using a custom Supabase domain, add only that exact origin to `connect-src`, rebuild, and verify. Do not broadly allow arbitrary origins.

# Testing an in-app weekly check-in locally

Run each command from WSL in the repository directory.

1. Start Supabase and apply the local migrations:

   ```bash
   npx supabase start
   npx supabase db reset
   ```

2. In a separate WSL terminal, start the Edge Function. In-app delivery does not call Mailjet, so placeholder Mailjet values from the committed example are sufficient:

   ```bash
   npx supabase functions serve weekly-checkin --env-file supabase/functions/.env.example
   ```

3. In another WSL terminal, start the frontend:

   ```bash
   npm run dev
   ```

4. Sign in with a local user, open **Settings → Weekly budget check-in**, enable weekly check-ins and **In app**, then save.
5. Select **Send in-app test**. A delivered check-in appears above the current application page. Its delivery also appears under **Recent delivery activity**.

If the button remains disabled, save the opt-in first and ensure the preference is not paused. If the request fails, keep the Edge Function terminal open and confirm the local `VITE_SUPABASE_URL` and publishable key point to the output from `npx supabase status`.
