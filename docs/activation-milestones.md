# Activation milestones

Buddy Budget acknowledges only six meaningful first completions: a budget, transaction categorisation, month close, goal contribution, export, and restore. Registration alone never qualifies. Messages contain no balances or other financial values, and the product does not use streaks, rankings, badges, confetti, or negative language about spending.

Household work is claimed once per household; exports and restores are claimed once per user. `claim_activation_milestone(text)` derives the authenticated scope and relies on a unique PostgreSQL constraint, so concurrent tabs cannot create or display duplicate completions. Viewers cannot claim household mutation milestones.

The acknowledgement is a dismissible, non-modal complementary region. It never takes focus, blocks navigation, or uses an assertive live region. Its action links to the next useful screen. Motion is not required to understand it, and the reduced-motion stylesheet removes animation and transition behavior.

Milestone rows are operational product state rather than financial backup data. They are intentionally excluded from JSON export and restore so backups do not carry behavioral history between accounts. A successful export or restore may claim its own milestone only after the core operation succeeds; claim failures never turn that operation into an error.

## Manual accessibility checks

1. Complete each eligible action and confirm the acknowledgement appears after success, not before.
2. Navigate past and dismiss the acknowledgement using only the keyboard.
3. Confirm focus remains on the current workflow and screen readers encounter the acknowledgement in ordinary document order.
4. Enable reduced motion at the operating-system level and confirm no milestone animation runs.
5. Open two tabs and complete the same first action; confirm only the tab winning the database claim shows feedback.
6. Trigger an error and confirm no milestone appears or covers the error or recovery result.
