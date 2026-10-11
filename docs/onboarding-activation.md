# First-budget onboarding

Onboarding offers four paths that all produce the same owned profile, preferences, categories, template, current-month snapshot, and completion marker:

- **Curated starter:** preview and customise a versioned starter before copying it.
- **Saved plan:** review the plan explicitly approved in the demo or public calculator. Demo transactions are never transferred.
- **CSV statement:** parse and map a current-month statement locally, then create a plan from its income and expense totals and import the valid rows as posted actuals.
- **Simple plan:** edit a small set of income and expense items from scratch.

Theme and advanced preferences are deferred to Settings. Every path includes basics, a path-specific preview, and a final review before anything is written.

## Resume and privacy

Incomplete progress is stored under `buddy-budget-onboarding:<user-id>` and is validated before use. A different signed-in account cannot load that draft. The approved demo/calculator handoff remains a short-lived, owner-neutral input until the signed-in user selects that path.

Raw CSV bytes and parsed CSV rows are never written to browser storage. A refresh preserves the selected CSV path and ordinary form progress, but the statement must be selected again. The server receives only explicitly confirmed normalized rows.

## Idempotency and recovery

Each browser draft receives a UUID setup key. `complete_first_budget_onboarding(...)` serializes completion per household, validates role and category ownership, and creates the first budget atomically. CSV transactions use the existing bounded, fingerprinted import operation inside the same transaction. The activation table permits one completion per household, so retries and double submissions return the existing month instead of duplicating templates, months, or transactions.

After success, the client clears household-scoped query data, seeds the completed preference record, removes its account-scoped draft, consumes an approved transfer only when that path was used, and navigates directly to the populated month.

## Manual checks

1. Start each path from a disposable account and confirm the final dashboard has the selected plan.
2. Refresh on the basics and plan steps; confirm progress resumes for the same account.
3. Sign into another account in the same browser; confirm it cannot see the first account's draft.
4. Double-click the final action or retry after interrupting the response; confirm only one template and month exist.
5. For CSV, use current-month valid and invalid rows; confirm the raw file is not retained, invalid rows are counted, and valid actuals are assigned to the imported budget items.
