# Bounded property and fuzz testing

Buddy Budget uses `fast-check` with Vitest for deterministic, local property tests. These tests
exercise pure calculations and trust-boundary parsers only. They never call Supabase, external
providers, production endpoints, or real user accounts.

## Invariants and limits

| Surface       | Invariant                                                                                                                  | Bounds                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Exact money   | Canonical decimal strings round-trip to the original safe minor-unit integer; income and expense aggregation remains exact | 150–200 runs; at most 40 items                          |
| CSV           | Quoted Unicode cells survive every supported delimiter; formula-prefixed amounts never become transactions                 | 80–120 runs; at most 20 rows and 32 characters per cell |
| Backup JSON   | Ownership and credential fields are removed at any allowed depth; unsupported versions and excessive nesting are rejected  | 30–100 runs; maximum tested depth 84                    |
| Pages routing | Encoded route, query, and fragment data survives fallback restoration beneath the repository base path                     | 150 runs; at most five route/query components           |
| Schedules     | Generated dates are sorted, unique, bounded, and satisfy their recurrence predicate                                        | 150 runs; windows capped at 90 days                     |

CI seeds are fixed in each suite. Fast-check reports the seed and shrink path when an invariant
fails. The replay suite deliberately captures a synthetic failing property with `fc.check` and
proves the reported seed/path reproduces the same counterexample without making CI fail.

Run the bounded suite with:

```bash
npm run test:properties
```

If a generator discovers a product defect, add the minimized counterexample as a normal permanent
regression fixture before fixing the implementation. Keep generator sizes and run counts bounded;
do not increase them until the Quality workflow timeout has been measured. Longer fuzzing is not
scheduled because this repository does not currently need a second artifact-producing workflow.
