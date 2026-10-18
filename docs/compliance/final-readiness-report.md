# Final private-test readiness report

Review date: 18 October 2026  
Scope: private authorised testing only  
Decision: **NO-GO in the currently evidenced state**

This is an evidence-based release assessment, not legal advice, a certification of compliance, or approval for public or commercial use.

## Executive decision

Buddy Budget has meaningful repository-level privacy and security controls, including RLS, least-privilege database grants, local tester admission, scoped exports, deletion failure handling, private-cache exclusions, secret scanning, and repeatable regression tests. The latest publicly visible Quality workflow completed successfully on 18 October 2026 for commit `3956b2238a31209df127655f45df6e8c41951865`.

Private authorised testing is nevertheless **NO-GO today** because the required operating conditions are not evidenced:

1. **CONFIRMED:** `https://andy-nkumane.github.io/buddy-budget/` returned `200 OK` on 18 October 2026 and its HTML declared `robots=index, follow`. The response was last modified on 13 October 2026, so it is not proven to contain the compliance controls reviewed in later commits. The GitHub repository is also public. This does not match a genuinely private authorised-testing posture.
2. **CONFIRMED:** the Privacy Policy and Terms deliberately identify themselves as draft and not effective. The responsible party, effective dates, approved contact routes, purposes/lawful grounds, age rule, and complaints process remain unresolved.
3. **CONFIRMED:** local configuration and migration `202610170001` implement an allowlist-based Before User Created hook. **UNVERIFIED:** no supplied hosted evidence proves that the hook is selected in the deployed Supabase project or that public signup is disabled as a fallback.
4. **CONFIRMED:** owner decisions `OD-001` through `OD-020` remain pending, including P0 decisions for operator identity, Information Officer arrangements, transfers/operators, tester governance, lawful grounds, retention, incident roles, backup recovery, and hosted Supabase security.
5. **UNVERIFIED:** no dated hosted evidence proves migration parity, effective production grants/RLS, secret placement, provider regions/contracts, backup/PITR capability, restore testing, RPO/RTO, log retention, or deletion behavior across backups/providers.

The project can move to **CONDITIONAL** readiness only after every release blocker below is completed and independently reviewed. A **GO** decision requires signed owner approval and legal/privacy review of the final operating facts; automated tests alone cannot produce it.

## Requirement assessment

| Area                             | Classification | Evidence                                                                                                                   | Unresolved risk / approval                                                                                                                          |
| -------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product scope                    | CONDITIONAL    | UI and policies consistently describe experimental, non-commercial authorised testing                                      | Public routes and indexing contradict the intended access posture; owner must restrict deployment and prove the deployed commit                     |
| Tester admission                 | NO-GO          | Local Auth hook, private allowlist, migration and pgTAP coverage exist                                                     | Hosted hook selection or disabled signup is not evidenced; complete `OD-005` and `OD-019`                                                           |
| Privacy transparency             | NO-GO          | Contextual notices and public legal routes are tested                                                                      | Draft policy has no responsible-party facts, approval or effective date; complete `OD-001`, `OD-007`, `OD-009`                                      |
| Terms and disclaimer             | NO-GO          | Draft terms preserve non-waivable rights and financial disclaimer warns testers                                            | Terms explicitly say they are not effective; complete `OD-020` and legal approval                                                                   |
| Database isolation               | CONDITIONAL    | RLS, ownership constraints, privilege hardening and 383 local pgTAP assertions passed during PR 11 verification            | Apply all migrations and repeat catalog/isolation checks in disposable staging; record results under `OD-019`                                       |
| Browser/PWA privacy              | CONDITIONAL    | No-store wrapper, public-only precache policy and scoped logout cleanup have unit coverage                                 | Inspect deployed Cache Storage and network responses; public HTML currently has a ten-minute cache                                                  |
| Exports, correction and deletion | CONDITIONAL    | Ownership, correction roles, deletion failures and local cascades are tested                                               | Approve request handling and retention exceptions; complete disposable staging deletion/export exercise and backup re-deletion procedure            |
| Public sharing                   | CONDITIONAL    | Public-link identifiers are stored as hashes; links expire, can be revoked, and return no-store responses                  | Residual snapshot retention, log/referrer verification and disclosure response remain open (`COMP-008`, `OD-013`)                                   |
| Providers and transfers          | NO-GO          | Processor and transfer inventories identify Supabase, GitHub and Mailjet                                                   | Actual account entities, plans, regions, agreements, subprocessors and section 72 grounds are unverified (`OD-003`, `OD-004`, `OD-015`)             |
| Incident response                | NO-GO          | Playbook, section 22 decision path and tabletop scenario exist                                                             | Roles, alternates, portal/provider access and completed exercise evidence are absent (`OD-011`)                                                     |
| Backup and recovery              | NO-GO          | Recovery responsibilities and limitations are documented                                                                   | Backup capability, recovery owner, RPO/RTO and successful non-production restore are absent (`COMP-020`, `OD-012`)                                  |
| Supply chain and CI              | CONDITIONAL    | Lockfile, audit, gitleaks, compliance boundary checks, unit, browser and database jobs exist; latest Quality run was green | SBOM, dependency-review policy and remediation SLA remain open (`COMP-018`)                                                                         |
| PAIA governance                  | NO-GO          | Applicability questions and manual inputs are documented                                                                   | Private-body/head determination, Information Officer registration, manual and request operation require owner/legal completion (`OD-002`, `OD-010`) |
| Financial regulation guardrails  | CONDITIONAL    | No product advice, custody, credit provision or debt counselling was identified                                            | `OD-016` must be approved; any such scope change triggers a new specialist review before implementation                                             |

## Evidence boundaries

Repository evidence was inspected across routes, legal wording, authentication, migrations, RLS tests, exports, deletion, storage, Edge Functions, CI and deployment documentation. Public HTTP evidence was limited to non-authenticated status, headers and HTML. No Supabase dashboard, production database, secret store, provider console, contracts, backups, logs, tester records or private organisational records were accessed.

The public response included HSTS, but no response-level Content-Security-Policy, Referrer-Policy, X-Content-Type-Options or Permissions-Policy was observed. A meta CSP exists in the HTML; it is not evidence that every desired response-header control is deployed. The direct `/buddy-budget/privacy` request returned the expected GitHub Pages `404.html` fallback for client-side restoration, but browser execution was not treated as proof of hosted Auth configuration. The deployment timestamp predates the reviewed compliance commits, and no release marker tied the served assets to a reviewed commit.

## Decision conditions

Change this decision from **NO-GO** to **CONDITIONAL** only after all P0 items in the release checklist have dated evidence and no unresolved result remains. Change it to **GO for private authorised testing only** only when:

- an accountable owner signs the release record;
- legal/privacy review approves the final policy, terms, operator facts and testing posture;
- the deployment is demonstrably restricted to approved testers;
- staging security, deletion, export and restore evidence passes;
- incident and recovery owners accept their duties; and
- remaining P1/P2 risks are remediated or explicitly accepted with review dates.

Public access, public acquisition, general availability, paid use, advertising, monetisation, financial-product advice, payments, credit, debt counselling, or materially different processing requires a new legal, privacy and security review. This private-test decision cannot be reused for those purposes.

## Rollback consideration

If any hard gate fails after release, disable new signup, revoke tester access where appropriate, pause notification delivery and public sharing, preserve incident evidence, and take the private-test deployment offline until the failed control is restored. Documentation rollback is a normal Git revert; no database rollback is introduced by this report.
