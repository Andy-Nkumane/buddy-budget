# Budget item grouping decision

## Decision

Do not add independent user-defined budget sections in this initiative. The verified customer benefit does not clearly exceed the duplication, migration, historical-snapshot, sharing, restore, accessibility, and maintenance cost.

No schema, migration, generated type, RPC, or runtime UI change is included. If users need faster scanning, validate presentation-only grouping by the existing category snapshot before introducing another editable hierarchy.

## Evidence from the current application

- Budget items already have an `income` or `expense` type, an ordered household-owned category, and an independent item order.
- Template items copy their category, type, amount, and order into monthly snapshot items. Existing months remain independent from later template edits.
- Monthly items preserve `category_snapshot`, and historical-month triggers prevent changes after the lock boundary.
- Categories already drive transaction categorisation, insights, aggregated shared reports, budget reports, starter templates, onboarding, demo/calculator transfers, schedules, goals, and adviser data.
- Household RLS permits owners and editors to mutate plan data while viewers remain read-only.
- Portable backup and restore, starter copying, shared-template copying, and onboarding setup each have versioned or transactional copy contracts that would need section-aware remapping.
- The budget UI currently uses semantic Income and Expenses sections and shows the category on each row. Templates likewise separate items by type and preserve explicit item ordering.

## Options considered

| Option                                           | Customer clarity                                                                  | Editing burden                                                          | Data and migration cost                                                                              | Historical and sharing risk                                                                                                     | Maintainability | Decision                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------- |
| Keep income/expense with category labels         | Familiar and already consistent across the product                                | None                                                                    | None                                                                                                 | None                                                                                                                            | Lowest          | Keep as the current baseline                              |
| Presentation-only groups derived from categories | Potentially improves scanning without adding a new concept                        | None beyond existing category management                                | No schema migration; UI and accessibility work only                                                  | Low if grouping uses the stored monthly category snapshot                                                                       | Moderate        | Recommended experiment if user research confirms the need |
| Independent optional sections                    | Flexible, but users must understand the difference between a section and category | Create, name, assign, reorder, delete, and maintain sections separately | New household/type tables or columns, constraints, RPCs, RLS, generated types, and backup versioning | High: template/month snapshots, locked history, starter/shared copies, reports, adviser scope, and restore remapping all change | Highest         | Rejected for this initiative                              |

## Why independent sections were rejected

### Duplicate concepts

Categories already provide named, type-specific organization and are visible in plan rows and downstream reporting. A separate section such as "Housing" beside a Housing category creates two competing labels without a verified workflow that needs both.

### Snapshot and history complexity

Sections could not safely be a live reference only. Templates would need section structure, monthly items would need immutable section snapshots and independent order, and locked months would need database enforcement for section assignment and ordering. Later template edits must not rewrite past months.

### Broad compatibility surface

Independent sections would affect starter templates, onboarding, demo/calculator transfers, public template snapshots, copy remapping, reports, adviser views, exports, restores, fixtures, and generated database types. Deleting a section would also require a transactional rule that preserves every item.

### Accessibility and mobile cost

Section creation and two levels of ordering require keyboard-accessible controls that do not depend on drag-and-drop. Nested headings and reorder controls would add substantial density to already compact mobile budget and template screens.

## Lower-cost validation path

1. Observe whether users struggle to scan budgets with many items and whether category labels solve the problem.
2. Prototype category-derived headings using `category_snapshot` for monthly budgets and the linked category for templates.
3. Keep Income and Expenses as the top-level semantic sections and provide a stable Uncategorised group.
4. Preserve existing item order within each category and verify that grouping does not imply changed calculations or report meaning.
5. Test the prototype at mobile widths, 200% text zoom, with keyboard navigation, and with screen readers before considering persistence changes.

## Reconsideration criteria

Reopen the independent-section design only with evidence that users need stable groups that are meaningfully different from categories. A future proposal must define ownership, type constraints, duplicate-name behavior, deletion semantics, template-to-month snapshots, locked-history enforcement, copy/remap behavior, backup schema evolution, report scope, accessible ordering, and a forward-only migration plan before implementation.

## Runtime and deployment impact

None. This decision adds documentation only. There is no migration, generated-type change, provider configuration, production deployment order, or rollback operation.
