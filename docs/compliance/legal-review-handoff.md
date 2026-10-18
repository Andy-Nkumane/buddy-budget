# Legal and privacy review handoff

Prepared: 18 October 2026  
Intended decision: private authorised testing only

This handoff identifies questions requiring qualified South African legal/privacy review. It does not ask the reviewer to infer missing facts or approve a public/commercial launch.

## Product facts evidenced in the repository

- Buddy Budget is a budgeting SPA using Supabase Auth/PostgreSQL/Edge Functions, GitHub Pages and optional Mailjet delivery.
- It processes identity, household relationships, planned and actual financial records, transactions, goals, schedules, uploaded-statement-derived records, notifications, sharing metadata and access/audit events.
- Raw CSV files are parsed locally; accepted structured records are sent to Supabase.
- Public report/template links can expose owner-selected snapshots through opaque tokens; details are privacy-minimised by default.
- The application offers deterministic budgeting summaries, not evidenced financial-product recommendations, execution, custody, credit or debt counselling.
- Repository controls include RLS, household roles, historical locks, scoped exports, deletion, private-cache exclusions, server-only provider secrets and regression tests.
- The current GitHub Pages root is publicly reachable and indexable. The intended operating model is nevertheless private, experimental, non-commercial authorised testing.

## Facts the owner must supply

1. Responsible party/private-body legal identity, legal form, jurisdiction, addresses and head.
2. Information Officer/Deputy identities, registration status and authority.
3. Actual purposes and lawful grounds by data class and user relationship.
4. Approved minimum age and any third-party/household-data rules.
5. Supabase, GitHub and Mailjet contracting entities, plans, regions, agreements/DPAs, subprocessors, retention, support and incident terms.
6. Section 72 transfer grounds for each actual cross-border flow.
7. Retention, deletion, legal-hold, backup, log and restore re-deletion rules.
8. Monitored privacy, PAIA, support, complaint and incident channels.
9. Backup/PITR capability, RPO/RTO, recovery owner and restore evidence.
10. Exact tester selection, approval, expiry, revocation and offboarding process.

## Questions for legal/privacy counsel

- Confirm the responsible party, operator roles and written section 21 requirements for actual provider agreements.
- Confirm POPIA lawful grounds, purpose wording, minimisation and retention for each inventory class; do not default every activity to consent.
- Confirm section 72 grounds and onward-transfer safeguards for deployed provider locations and cross-border recipients.
- Determine the operator’s PAIA private-body/head position, section 51 manual obligations, prescribed request process and Information Officer requirements.
- Approve the final Privacy Policy, Terms, disclaimer, acceptance evidence, change-notice process and effective dates.
- Determine the minimum-age rule and whether any child-processing design is permissible.
- Approve access, correction, objection and deletion procedures, including immutable financial history, shared records, legal holds, backups and refusal/appeal routes.
- Review public-link sharing, adviser access, household records, Mailjet delivery and incident notification language.
- Confirm ECTA/CPA implications for the exact private-test operation and the controls required before any public or commercial supply.
- Confirm the FAIS/FICA/NCA guardrail and the trigger for renewed specialist review.

## Documents for review

- `data-inventory.md` and `data-flow-map.md`
- `legal-applicability.md`
- `processor-register.md` and `international-transfer-assessment.md`
- `paia-assessment.md` and `governance-checklist.md`
- `account-deletion-and-retention.md` and `data-access-and-correction.md`
- `incident-response.md`, `breach-notification.md`, and `incident-exercise.md`
- `gap-register.md`, `owner-decisions.md`, `final-readiness-report.md`, and `release-checklist.md`
- Current Privacy Policy, Terms, financial disclaimer and collection notices in `src/features/legal` and `src/shared/ui/CollectionNotice.tsx`

## Requested review output

For each issue, record the reviewed fact set, conclusion, required wording/control, responsible owner, deadline, evidence location and re-review trigger. Clearly separate mandatory requirements, conditional requirements and recommended safeguards. Do not describe the project as compliant merely because documents or tests exist.

Approval, if granted, must say **“GO for private authorised testing only”** and identify the exact release/environment. It must not be interpreted as approval for public access or monetisation. Either change requires a new legal, privacy and security review.
