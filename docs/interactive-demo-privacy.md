# Interactive demo privacy and conversion

The public `/demo` route uses a deterministic fictional salary, plan, and transaction set. Demo edits remain in React memory. The route does not initialize Buddy Budget authentication, household queries, repositories, or Supabase access, even when the browser already contains a valid session.

Buddy Budget currently has no privacy-approved analytics integration, so the demo emits no funnel, advertising, fingerprinting, or third-party tracking events.

## Starter-plan handoff

“Start with this setup” is the explicit approval boundary. It writes one versioned local record containing only:

- template name and currency;
- recurring item names and categories;
- income/expense type;
- approved planned amount in integer minor units; and
- a 24-hour expiry.

The handoff never contains sample transactions, descriptions, actual totals, authentication details, ownership IDs, or household data. Onboarding validates the record before displaying it and removes it after the first successful setup. Invalid, oversized, unsupported, or expired records are deleted without being sent to Supabase.

Resetting the demo recreates the original fictional state. It does not change an already approved handoff; pressing “Start with this setup” again explicitly replaces that handoff with the currently displayed plan.

## Verification

1. Open `/demo` in a signed-out browser and add a sample transaction.
2. Confirm the Network panel contains no Supabase write or financial-data request.
3. Reset and confirm the original totals return.
4. Approve the starter plan and inspect `buddy-budget-approved-demo-plan`; confirm it contains no `transactions` field.
5. Register and complete onboarding; confirm the template is created once and the local handoff is removed.
6. Visit `/demo` directly while another tab is signed in; confirm no household request occurs.
