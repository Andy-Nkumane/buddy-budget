# Public monthly budget calculator

`/calculator` is a public acquisition route. It is lazy-loaded and rendered without authentication, Supabase providers, analytics, or third-party requests.

## Privacy and conversion

Income and expense rows remain in React memory. Refreshing or selecting Reset restores the neutral zero-value plan. Buddy Budget writes nothing to local storage or Supabase until the visitor selects **Create an account and save this plan**.

That explicit action stores only currency, locale, template name, and the approved plan rows in the existing expiring onboarding handoff. The handoff expires after 24 hours and is removed only after onboarding completes successfully. Transactions, browsing activity, authentication data, and analytics identifiers are not included.

## Calculations

Amounts allow non-negative values with no more than two decimal places. Totals use the same integer-minor-unit parser as authenticated monthly budgets:

- income: sum of valid income rows;
- expenses: sum of valid expense rows;
- remaining: income minus expenses, including negative results;
- savings rate: remaining divided by income, or unavailable when income is zero.

The calculator is a planning aid and does not provide personalised financial, tax, credit, or investment advice.

## Routing and metadata

The route works with the repository's GitHub Pages `404.html` route preservation and configurable Vite base path. Runtime metadata sets a descriptive title, description, and canonical URL using the deployed origin and base path. The PWA build precaches the lazy calculator chunk for repeat/offline access after the assets have been installed.
