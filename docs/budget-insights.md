# Budget insights

The Insights page uses `retrieve_budget_insights` to aggregate at most 60 calendar months inside PostgreSQL. The browser receives bounded monthly, category, recurring-change, discretionary-expense, income-stability, and goal summaries instead of transaction history.

## Metric definitions

- **Planned amount:** active, unpaused budget-month items in integer minor units.
- **Actual amount:** posted transactions. Refunds reverse their transaction type; pending and void transactions contribute zero.
- **Variance:** actual minus planned. Positive expense variance means overspending.
- **Savings:** adjusted actual income minus adjusted actual expenses. Savings rate divides savings by positive actual income and is unavailable for zero or negative income.
- **Category average:** category actual divided by selected months having category plan or activity.
- **Repeated overspending:** an expense category above plan in at least two selected months.
- **Recurring change:** a changed monthly total between consecutive observations with the same normalized description, type, and currency. Only recurring-candidate transactions qualify.
- **Largest discretionary expense:** a posted, non-refund expense not matched to a payment schedule. This scheduling proxy does not judge whether a purchase was necessary.
- **Income stability:** observed minimum, maximum, and average monthly income. Relative range requires three whole-budget months and positive average income.
- **Goal progress:** savings and sinking-fund progress is starting balance plus valid contributions; debt progress is valid contributions paid down.

## Filters and historical semantics

Date boundaries include both calendar months. Category filters scope plan, actual, recurring, discretionary, and matching goal figures. Whole-budget savings and income-stability conclusions are withheld for category-only views.

Locked reports remain in trends. Explicit historical adjustments affect the original month's whole-budget interpretation without changing its snapshot or transactions. Adjustments have no category, so category views exclude them instead of inventing an attribution. Currencies remain separate; no exchange rate is applied.

Charts always have a table or text alternative. “Insufficient data” is different from a measured zero.

PDF exports can optionally include the monthly insight summary for the selected export range.
