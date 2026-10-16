# Compliance owner decisions

Do not fill unknown facts with assumptions. The accountable owner should record a decision, approver, date, evidence link and review date for every item.

| ID     | Required decision                                                 | Why it matters                                                                               | Options / minimum evidence                                                                             | Status               |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| OD-001 | Name the responsible party/legal operator and jurisdiction        | Notices, contracts, rights and incident reporting require a real accountable entity/person   | Verified legal name, address and role; legal review                                                    | Pending              |
| OD-002 | Appoint/register the Information Officer and deputies as required | POPIA/PAIA accountability and request handling                                               | Appointment/registration evidence and responsibilities                                                 | Pending              |
| OD-003 | Confirm Supabase project regions and data residency               | Cross-border transfer, latency, backup and contract decisions                                | Production/staging regions and approved transfer assessment                                            | Pending              |
| OD-004 | Approve operator/subprocessor register                            | Supabase, GitHub and Mailjet process or host relevant data                                   | Current terms/DPA, roles, locations, security obligations, deletion and incident contacts              | Pending              |
| OD-005 | Choose authorised-testing or public-access posture                | Current code permits signup; project statement says authorised testing only                  | Tester allowlist/invite-only evidence, or approved public-launch programme and revised positioning     | Pending — P0         |
| OD-006 | Define eligible users/minimum age                                 | Public signup can include minors; financial/free-text data is sensitive                      | Adults-only rule and enforcement, or legally reviewed child-processing design                          | Pending              |
| OD-007 | Approve purposes and lawful bases per data class                  | Required for accurate notices and processing limitation                                      | Signed processing-purpose/lawful-basis register; do not default every purpose to consent               | Pending — P0         |
| OD-008 | Approve retention and deletion schedule                           | Code has mixed expiry, archive and immutable-history behaviour                               | Period per table/record, trigger, legal hold, purge/anonymise method, backups/logs and proof           | Pending              |
| OD-009 | Choose privacy/PAIA/support contact channels                      | Users need a monitored way to exercise rights and obtain help                                | Public addresses, owners, coverage and response escalation                                             | Pending              |
| OD-010 | Decide PAIA manual position                                       | Private-body duties/exemptions require current factual/legal review                          | Legal opinion and, if required, approved section 51 manual/publication evidence                        | Pending              |
| OD-011 | Approve incident and breach roles                                 | Security incidents require fast containment and lawful notification assessment               | Incident lead, Information Officer, technical/provider contacts, legal reviewer and after-hours route  | Pending — P0         |
| OD-012 | Set backup RPO/RTO and recovery owner                             | Existing users and migrations create material loss risk                                      | Plan capability, backup timestamp/retention, RPO/RTO, named owner and successful restore drill         | Pending — P0         |
| OD-013 | Decide shared-link residual retention                             | Expiry/revocation prevents access but does not necessarily erase stored snapshots            | Purge delay, audit need, user disclosure and incident response                                         | Pending              |
| OD-014 | Decide activity/audit-log retention and visibility                | Household/adviser accountability competes with minimisation and deletion                     | Approved retention and rules for actor identity after departure/deletion                               | Pending              |
| OD-015 | Approve Mailjet delivery configuration                            | Email transfers identity and may reveal budget context                                       | Sender, region/contract, privacy mode default, bounce/unsubscribe owner and retention                  | Pending              |
| OD-016 | Define financial-regulatory change gate                           | New advice, payment, credit or investment features can change FAIS/FICA/NCA status           | Named legal approver and checklist required before design/development                                  | Pending — P0 trigger |
| OD-017 | Decide production hosting/security-header approach                | GitHub Pages cannot emit every desired response header                                       | Accept documented limits for closed testing or choose a host/proxy that supports required headers      | Pending              |
| OD-018 | Approve rights-request and deletion exceptions                    | Export/delete UI is not a complete legal procedure                                           | Identity checks, correction/objection, shared records, immutable history, backups, refusal/escalation  | Pending              |
| OD-019 | Approve and evidence hosted Supabase security settings            | Local migrations cannot prove production Auth, API, network, secrets or backup configuration | Complete the production checklist in `supabase-security-hardening.md` with dated, secret-free evidence | Pending — P0         |
| OD-020 | Approve Terms, supplier disclosures and complaints process        | Draft routes cannot establish binding terms or satisfy conditional ECTA/CPA duties           | Legal approval, operator details, governing law/forum, version/effective date and redress process      | Pending              |

## Decision record template

```text
Decision ID:
Decision:
Scope/environment:
Approver and role:
Legal/privacy reviewer (if applicable):
Date:
Evidence link/location:
Risks accepted:
Controls/conditions:
Review date or trigger:
```

## Release gate

Do not treat this baseline as approval to expose real user data. At minimum, resolve or explicitly block deployment on `OD-001`, `OD-002`, `OD-005`, `OD-007`, `OD-011`, and `OD-012`, plus all P0 gaps in the gap register. Conditional FAIS/FICA/NCA items become release blockers if product scope changes into the relevant regulated conduct.
