# Cash-flow calendar and weekly check-in testing

This guide explains what the two features do, how to test them locally and in production, and what result to expect from each important edge case.

## What each feature does

### Cash-flow calendar

A payment schedule is a forecast, not a transaction. It tells Buddy Budget that income or an expense is expected on one or more dates. The forecast affects the projected balance but does not affect actual spending or income.

An occurrence starts as **Expected**. It can then become:

- **Paid** for a confirmed expense.
- **Received** for confirmed income.
- **Skipped** when that occurrence will not happen.
- **Disabled** when its schedule is disabled. Existing history remains available.

Income is shown with `+`; expenses are shown with `-`. Expected entries use forecast styling, while paid and received entries use confirmed styling.

### Weekly budget check-in

The weekly check-in creates one concise summary from the user's current budget, transactions, schedules, and goals. It can be delivered in the app, by email, or through both channels. It sends nothing until the user explicitly opts in and saves at least one channel.

**Preview** only generates a private preview. **Send in-app test** creates an in-app test delivery. **Send email test** invokes the server-side Edge Function and Mailjet. The scheduled production job is separate from both test buttons.

## Localhost setup

Run all commands from WSL in the repository directory.

### 1. Start the local database

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

Copy the local API URL and publishable/anon key reported by `npx supabase status` into `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_LOCAL_ANON_KEY
VITE_BASE_PATH=/
```

Restart Vite after changing `.env.local`.

### 2. Start the weekly check-in Edge Function

In a second WSL terminal:

```bash
npx supabase functions serve weekly-checkin --env-file supabase/functions/.env.example
```

The committed example values are sufficient for an in-app test because that channel does not call Mailjet. To test email locally, copy the example to the ignored `supabase/functions/.env.local`, add valid Mailjet API credentials and a verified sender, and serve with that file instead.

### 3. Start the application

In a third WSL terminal:

```bash
npm run dev
```

Open the Vite URL, create or sign in to a local account, and complete onboarding.

## Local cash-flow test

1. Open **Cash flow**.
2. Select **New schedule**.
3. Create income named `Salary`, amount `10000`, recurrence **Once**, and choose a date within the next seven days.
4. Create expense named `Rent`, amount `2500`, recurrence **Once**, and choose an earlier date.
5. Check both **List** and **Calendar** views.

Expected result:

- Salary is displayed as `+ ZAR 10,000.00` and Rent as `- ZAR 2,500.00`, subject to the selected locale's separators.
- Both entries are marked Expected and use expected/forecast styling.
- Projected balances increase for Salary and decrease for Rent.
- The summary shows Rent under obligations due before the next income.
- On mobile, the seven days are separate horizontally scrollable cards; swiping sideways moves between days.

Then mark Salary received and Rent paid. Expected result:

- Their labels change to Received and Paid.
- Their confirmed styles differ from Expected.
- They are not counted again as outstanding forecasts.

## Local weekly check-in test

1. Open **Settings → Weekly budget check-in**.
2. Enable **Weekly check-ins** and **In app**.
3. Ensure **Pause delivery** is off.
4. Save preferences. The test button uses saved preferences, not unsaved form values.
5. Select **Preview**.
6. Select **Send in-app test**.

Expected result:

- Preview shows one deterministic recommendation and counts for exceeded, approaching, uncategorised, and due-soon items.
- Preview does not create a delivery record.
- Send in-app test shows a success message, creates a delivered test entry under **Recent delivery activity**, and makes the check-in available in the application.
- Repeating the test creates a separate test delivery; scheduled weekly deliveries use idempotent weekly job keys.

For a local email test, enable and save **Email**, then select **Send email test**. Expected result: the UI reports that the test was accepted, Mailjet delivers to the account email, and recent activity records the outcome. If the sender or credentials are invalid, no secret should appear in the UI or stored error summary.

## Production deployment and testing

Use a staging Supabase project first when possible.

### Deploy

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set --env-file supabase/functions/.env.local
npx supabase functions deploy weekly-checkin
```

The production function environment needs Mailjet API credentials, a verified sender, and the application URL. Never place Mailjet credentials or the service-role key in `.env.local` used by Vite, GitHub Pages variables, or any `VITE_` variable.

In Supabase Vault, configure the project URL and service-role key names required by the weekly-check-in migration. Confirm the `buddy-budget-weekly-checkins` Cron job exists and runs every 15 minutes.

### Production smoke test

1. Sign in with a dedicated test account.
2. Create the Salary and Rent schedules described in the local test.
3. Verify the list, calendar, signs, statuses, projected balance, and mobile horizontal calendar.
4. Open weekly check-in settings, opt in to In app, save, preview, and send an in-app test.
5. Enable Email, leave detailed financial values off, save, and send an email test.
6. Confirm the privacy-minimised email contains no detailed financial values and its link opens the authenticated Buddy Budget screen.
7. Enable detailed financial values, save, send another email test, and confirm values now appear.
8. Pause delivery and verify both test-send buttons become unavailable.
9. Opt out and verify the next scheduled Cron run creates no delivery.

Inspect Edge Function and Cron logs only for status information. Do not copy authorization headers, Mailjet credentials, message content, or service-role values into tickets or logs.

## Cash-flow edge cases

| Case                       | Test                                                        | Expected result                                                                                                |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| One-time payment           | Create recurrence **Once**                                  | Exactly one occurrence is created on the payment date.                                                         |
| Monthly on day 29–31       | Start a monthly schedule near month end                     | Short months use their final valid day; leap-year February uses the 29th.                                      |
| Weekly                     | Create a weekly schedule                                    | Occurrences repeat every seven calendar days from the start date.                                              |
| Fortnightly                | Create a fortnightly schedule                               | Occurrences repeat every fourteen calendar days.                                                               |
| Selected days              | Select two weekdays                                         | An occurrence appears only on each selected weekday on or after the start date.                                |
| End date                   | Add an end date                                             | Nothing is generated after the end date.                                                                       |
| Income sign                | Create any income schedule                                  | List and calendar show `+` before the formatted amount.                                                        |
| Expense sign               | Create any expense schedule                                 | List and calendar show `-` before the formatted amount.                                                        |
| Approximate amount         | Enable approximate amount                                   | The entry remains a forecast and is labelled approximate where details are shown.                              |
| Overdue expected item      | Leave an earlier expected occurrence unconfirmed            | The list labels it overdue; projection treats it as due today rather than silently dropping it.                |
| Paid expense               | Mark an expected expense paid                               | Status becomes Paid and it no longer remains an expected forecast.                                             |
| Received income            | Mark expected income received                               | Status becomes Received and it no longer remains an expected forecast.                                         |
| Skipped item               | Skip an occurrence                                          | Status becomes Skipped and it does not affect the projection.                                                  |
| Disabled schedule          | Disable an enabled schedule                                 | Current/future expected occurrences appear Disabled and do not affect the projection; past history remains.    |
| Re-enabled schedule        | Re-enable it                                                | Eligible disabled future occurrences return to Expected without duplicating history.                           |
| Matching transaction       | Confirm the suggested matching transaction                  | The occurrence links to the posted transaction and the forecast is not counted a second time.                  |
| Uncertain match            | Have several plausible transactions                         | Buddy Budget requires confirmation and does not silently choose one.                                           |
| Negative projected balance | Schedule expenses above available balances                  | Lowest projected balance and affected day use risk styling.                                                    |
| No schedules               | Use an account with none                                    | An empty-state message appears; the page does not fail.                                                        |
| Timezone boundary          | Test near midnight with profile timezone different from UTC | Today and occurrence dates follow the profile/schedule timezone rather than the browser's accidental UTC date. |
| Locked historical month    | Try changing an old occurrence through the API              | The database rejects the mutation; historical reports remain unchanged.                                        |
| Cross-user access          | Query another user's schedule/occurrence                    | RLS returns no accessible record and mutation is rejected.                                                     |

## Weekly check-in edge cases

| Case                       | Test                                                                            | Expected result                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Not opted in               | Leave opt-in off                                                                | No test or scheduled message can be sent.                                                          |
| No channel                 | Opt in but clear both channels                                                  | Saving is rejected with an instruction to choose a channel.                                        |
| Unsaved preference changes | Toggle opt-in without saving                                                    | Test buttons still reflect the last saved settings.                                                |
| Paused                     | Save with Pause delivery on                                                     | Scheduled and test delivery are suppressed; preferences remain stored.                             |
| In-app only                | Enable only In app                                                              | No Mailjet request is made; an in-app delivery is recorded.                                        |
| Email privacy default      | Enable Email but not detailed values                                            | Email uses a privacy-minimised summary without detailed financial values.                          |
| Detailed email             | Explicitly enable detailed values                                               | Financial values may be included in the email summary.                                             |
| Timezone                   | Choose a timezone and local delivery time                                       | Eligibility is calculated using that local weekday/time, including date boundaries.                |
| Duplicate Cron invocation  | Invoke the same scheduled job twice                                             | The unique job key prevents a second weekly delivery.                                              |
| Provider rejection         | Make Mailjet return an error                                                    | Delivery records a non-sensitive failure and remains safely observable/retryable within its limit. |
| Ambiguous network outcome  | Interrupt after provider request                                                | The delivery is not automatically resent when doing so could duplicate an email.                   |
| Bounce or block            | Mark email state bounced/blocked                                                | Further email is suppressed until the state is safely resolved.                                    |
| Opt out before dispatch    | Opt out before the next Cron run                                                | The function rechecks preferences and sends nothing.                                               |
| Account deletion           | Delete the test account                                                         | Preferences and delivery history are removed by the account cleanup path; later jobs send nothing. |
| No budget activity         | Preview a new/empty account                                                     | A valid low-priority recommendation appears; generation does not fail.                             |
| Existing issues            | Add exceeded items, uncategorised transactions, upcoming obligations, and goals | Counts reflect current data and exactly one deterministic recommended action is selected.          |

## Automated verification

Run from WSL:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

Database tests require the local Supabase Docker stack. Edge Function integration tests mock Mailjet and verify authorization, privacy modes, idempotency, and provider failures without sending real email.

## Troubleshooting

- **Send in-app test is disabled:** save opted-in preferences with In app enabled and Pause delivery off.
- **Function request fails locally:** keep `supabase functions serve` running and confirm `.env.local` points to the local URL/key from `npx supabase status`.
- **No email arrives:** check Mailjet sender verification, API credentials, recipient suppression/bounce state, and recent delivery activity.
- **No scheduled production delivery:** check saved weekday/time/timezone, opt-in/pause state, Cron execution, Vault secret names, and Edge Function response status.
- **Calendar appears empty:** ensure the occurrence falls between the current month start and the next 60 days and that its budget month exists.
- **Projection differs from expectation:** confirmed or matched occurrences are not forecasts; skipped and disabled occurrences are deliberately excluded.
