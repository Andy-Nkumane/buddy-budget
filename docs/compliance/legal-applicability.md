# South African legal applicability

This is a technical applicability assessment, not legal advice. Conclusions are based on the repository as reviewed on 15 October 2026 and must be revisited when operating facts or features change.

## Applicability matrix

| Framework             | Assessment                                                                                                         | Basis in the reviewed product                                                                                                                   | Required now vs conditional                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POPIA, Act 4 of 2013  | **LIKELY applicable** where the operator determines why/how South African users' personal information is processed | Identifiable accounts, household/adviser relationships, financial records, communications, sharing and access logs are processed                | Core processing conditions, transparency, security, operator controls, rights handling and breach readiness are likely mandatory; exact responsible party, lawful bases, cross-border conditions and Information Officer duties need legal/owner confirmation |
| PAIA, Act 2 of 2000   | **LIKELY relevant; exact private-body identity requires legal confirmation**                                       | A private operator holds records that may be requested to exercise/protect rights; POPIA access requests use PAIA mechanisms                    | Current Regulator guidance says the general section 51 manual exemption ended on 31 December 2021. Identify the private body/head, register the Information Officer, publish the required manual and operate prescribed requests if PAIA applies              |
| ECTA, Act 25 of 2002  | **Applicable to electronic communications generally; supplier/consumer provisions conditional**                    | Registration, emailed links, electronic acceptances, online publication and data messages exist                                                 | Draft Terms expose missing supplier information; preserve electronic evidence and verify section 43 and transaction duties before public/commercial supply                                                                                                    |
| CPA, Act 68 of 2008   | **POSSIBLE/conditional**                                                                                           | Current positioning is experimental/non-commercial authorised testing, but public registration and marketing-facing routes exist                | Draft Terms retain non-waivable rights; obtain legal review before public/commercial supply and implement fair terms, disclosures, complaints and redress appropriate to actual operations                                                                    |
| FAIS, Act 37 of 2002  | **Not evidenced by current budgeting functions; conditional P0 trigger**                                           | The app records budgets and produces deterministic planning prompts; it does not select or transact in a financial product on reviewed evidence | Do not add personalised recommendations concerning financial products or intermediary execution without specialist analysis/licensing assessment. “Not financial advice” wording does not cure regulated conduct                                              |
| FICA, Act 38 of 2001  | **Not evidenced as directly applicable; conditional P0 trigger**                                                   | The app is not shown to be a Schedule 1 accountable institution and does not hold/move funds or establish regulated client relationships        | Reassess before payments, custody, account operation, regulated financial services, crypto or other Schedule 1 activities; accountable-institution status depends on actual business, not app branding                                                        |
| NCA, Act 34 of 2005   | **Not evidenced by current budgeting/debt-tracking functions; conditional P0 trigger**                             | Debt-paydown goals only record user-provided information; no credit is granted and no debt counselling service is shown                         | Reassess before offering credit, credit guarantees, credit-bureau services, debt review/counselling, or lead/intermediary functions that fall within the Act                                                                                                  |
| Other financial rules | **POSSIBLE/conditional**                                                                                           | No bank feed, payment initiation, custody, insurance sale, investment product or regulated account aggregation appears in scope                 | Conduct a regulatory change assessment before any such feature; applicable frameworks may include payment, banking, insurance, market-conduct and cybercrime requirements                                                                                     |

## POPIA control mapping

| Processing condition/control       | Repository evidence                                                                                     | Baseline finding                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accountability and purpose         | Feature-level purposes can be inferred; operator identity and approved purposes are absent              | Gap `COMP-002`                                                                                                                                    |
| Processing limitation/minimisation | Local CSV parsing and privacy-minimised sharing/email defaults                                          | Useful technical controls; lawful basis and collection notice absent (`COMP-002`)                                                                 |
| Purpose specification/retention    | Expiry exists for invitations/shares/grants; financial/audit/delivery/backup retention is not scheduled | Gap `COMP-003`                                                                                                                                    |
| Further processing                 | Sharing and adviser access are explicit user actions with scoped snapshots/grants                       | Notice and lawful-basis assessment still required                                                                                                 |
| Information quality                | Users can edit much current data; immutable histories preserve audit meaning                            | Correction procedure for locked/third-party records requires documentation                                                                        |
| Openness                           | Feature help exists, but no complete verified privacy notice/operator contact was found                 | Gap `COMP-002`                                                                                                                                    |
| Security safeguards                | RLS, authenticated RPCs, token hashing, service secrets, no-store responses and tests                   | Strong baseline; incident procedure exists, while provider contracts and deployed operational evidence remain incomplete (`COMP-004`, `COMP-005`) |
| Data-subject participation         | Export/edit/delete features exist                                                                       | Incomplete formal rights procedure (`COMP-006`)                                                                                                   |

## Primary legal sources consulted

- [Protection of Personal Information Act 4 of 2013](https://www.justice.gov.za/legislation/acts/2013-004.pdf), including security safeguards and operator-contract requirements.
- [Promotion of Access to Information Act 2 of 2000](https://www.justice.gov.za/legislation/acts/2000-002.pdf), including private-body access and manual provisions.
- [Electronic Communications and Transactions Act 25 of 2002](https://www.gov.za/documents/electronic-communications-and-transactions-act).
- [Consumer Protection Act 68 of 2008](https://www.gov.za/documents/consumer-protection-act).
- [Financial Advisory and Intermediary Services Act 37 of 2002](https://www.gov.za/documents/financial-advisory-and-intermediary-services-act); the Act defines regulated advice by reference to financial products.
- [Financial Intelligence Centre Act 38 of 2001](https://www.fic.gov.za/wp-content/uploads/2023/10/Financial-Intelligence-Centre-Act-2001-Act-38-of-2001.pdf); accountable institutions are persons listed in Schedule 1.
- [National Credit Act 34 of 2005](https://www.gov.za/documents/national-credit-act), governing consumer credit and registration of specified industry participants.

## Mandatory, conditional and recommended work

### Likely mandatory before processing real tester data

- Identify the responsible party and Information Officer arrangements.
- Publish an accurate collection/privacy notice with purposes, recipients, rights and contact channels.
- Establish lawful bases, retention, deletion, rights-request and security-incident procedures.
- Put written operator/security terms and cross-border transfer assessments in place.
- Restrict access to authorised testers if that remains the stated operating model.

### Conditional before public/commercial or regulated expansion

- CPA/ECTA supplier disclosures, terms, marketing and complaints review.
- FAIS/FICA/NCA and adjacent financial-regulatory assessment before regulated activities.
- Children's/special-personal-information controls if the intended audience or collection changes.

### Recommended assurance

- Independent RLS/Edge Function security review and production policy verification.
- Restore drill, incident tabletop, rights-request exercise and deletion verification.
- Dependency/SBOM monitoring, access reviews, secret rotation and documented release approvals.
