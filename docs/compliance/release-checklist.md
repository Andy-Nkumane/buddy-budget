# Private authorised-testing release checklist

Use this checklist for the exact deployment being approved. A checked box requires dated, secret-free evidence and a named reviewer. Repository tests do not substitute for hosted verification.

## P0 hard gates — all required

- [ ] Record release commit, environment, public URL, Supabase project reference (non-secret), reviewer and decision date.
- [ ] Prove the deployed frontend and database migration history match the reviewed release commit; retain the Quality and deployment run URLs.
- [ ] Restrict access to approved testers. Prove the hosted Before User Created hook rejects an unapproved disposable address, or disable new signup. Remove public indexing and public promotion. (`COMP-001`, `OD-005`, `OD-019`)
- [ ] Name and verify the responsible party/legal operator and jurisdiction. (`OD-001`)
- [ ] Complete Information Officer/Deputy and PAIA governance required for the actual operator. (`OD-002`, `OD-010`)
- [ ] Approve purposes and lawful grounds for each data class. (`OD-007`)
- [ ] Approve final Privacy Policy and Terms with verified facts, version and effective date; configure monitored privacy, support and complaints routes. (`COMP-002`, `OD-009`, `OD-020`)
- [ ] Approve provider/operator agreements, deployed regions, subprocessors and section 72 transfer grounds for Supabase, GitHub and Mailjet. (`COMP-004`, `OD-003`, `OD-004`, `OD-015`)
- [ ] Apply every migration to disposable staging; prove zero anonymous public-table/function privileges, no browser-role `TRUNCATE`, and passing cross-user isolation tests. (`COMP-021`, `COMP-022`, `OD-019`)
- [ ] Verify secrets exist only in approved server-side stores; record owners and rotation dates without copying values. (`OD-019`)
- [ ] Approve retention/deletion rules, legal holds, backup/log limits and restore re-deletion. (`COMP-003`, `OD-008`, `OD-018`)
- [ ] Set backup capability, retention, RPO, RTO and recovery owner; complete and evidence a non-production restore. (`COMP-020`, `OD-012`)
- [ ] Assign incident lead/alternate, Information Officer, technical, legal and communications roles; verify portal/provider access and complete the tabletop. (`COMP-005`, `OD-011`)
- [ ] Run staging export, correction and account-deletion paths with disposable accounts; verify failure reporting, Auth removal, domain cleanup and documented provider/backup exceptions. (`COMP-006`, `COMP-007`)
- [ ] Confirm all CI jobs pass for the release commit, including gitleaks, compliance boundaries, public Playwright and pgTAP.
- [ ] Obtain owner and legal/privacy sign-off for **private authorised testing only**.

Any unchecked P0 item means **NO-GO**.

## P1/P2 controlled conditions

- [ ] Define the minimum-age rule and enforce or legally approve it. (`COMP-009`, `OD-006`)
- [ ] Approve public-share snapshot retention and verify token/referrer/log handling. (`COMP-008`, `OD-013`)
- [ ] Approve audit/activity-log retention and departed-user identity handling. (`OD-014`)
- [ ] Verify weekly email classification, opt-out, bounce/block, complaint and Mailjet retention handling. (`COMP-010`, `OD-015`)
- [ ] Approve correction/dispute annotation for immutable history. (`COMP-019`)
- [ ] Inspect deployed Cache Storage and confirm authenticated/API/export responses are not cached. (`COMP-023`)
- [ ] Record the GitHub Pages header limitation decision or move behind a host/proxy supporting the approved headers. (`COMP-017`, `OD-017`)
- [ ] Approve dependency triage ownership, SLA, SBOM/dependency-review approach. (`COMP-018`)
- [ ] Approve the financial-regulatory change gate. (`COMP-014`–`COMP-016`, `OD-016`)

Record every accepted residual risk with owner, rationale, compensating control, expiry and review trigger. Legal obligations cannot be waived through risk acceptance.

## Release record

```text
Release commit:
Environment and URL:
Supabase project reference:
Quality run URL:
Staging evidence location:
Outstanding accepted risks:
Owner decision: GO / CONDITIONAL / NO-GO
Owner name and date:
Legal/privacy reviewer and date:
Next review date or trigger:
```

## Automatic re-review triggers

Stop and perform a new legal, privacy and security review before public access, public marketing, monetisation, advertising, new analytics, new providers/regions, material sharing changes, children’s use, AI-based personal recommendations, financial-product advice, payments/custody, credit, debt counselling, or materially different data collection.
