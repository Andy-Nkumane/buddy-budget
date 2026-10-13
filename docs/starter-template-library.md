# Starter template library

Starter templates are versioned catalog records, not user or household financial data. Authenticated users can read active definitions, but browser roles cannot insert, update, or delete catalog content. Catalog maintenance therefore happens through reviewed database changes or an equivalent privileged deployment process without requiring a frontend release.

Version 1 includes Student, First salary, Household or couple, Freelancer, and Minimal essentials. Labels are deliberately general. Every suggested amount is zero so the library provides structure without presenting culturally specific costs, assumed income, or financial advice. The UI formats entered amounts with the profile currency and locale.

Copying creates ordinary household-owned categories, a template, and its selected items in one transaction. The owned template records the catalog ID and version for diagnostics. Amount changes in a later catalog version never update a previously copied template or any month snapshot.

The client generates one copy key per customization session. Retrying the same submission returns the existing template. A different customization session receives a different key. PostgreSQL validates roles, catalog version, item keys, amounts, categories, and household ownership before writing.

JSON backups include the source ID, version, and copy key as part of the owned template record. Restoration remains owner-scoped and transactional. The catalog itself is deployment-managed and is not duplicated into each user's backup.

## Adding a version

1. Insert a new `(id, version)` row instead of editing a released definition.
2. Insert uniquely keyed items with valid types, category labels, and sort order.
3. Keep amounts at zero unless product policy explicitly introduces reviewed financial guidance.
4. Run the catalog, copy, idempotency, ownership, restore, and snapshot tests.
5. Mark an obsolete version inactive only after clients no longer need to start new copies from it. Existing copied templates remain unchanged.
