# International transfer assessment

Reviewed on 18 October 2026. This is a transfer-screening record, not a completed legal transfer impact assessment or approval.

## POPIA section 72 test

Before personal information is transferred to a recipient in a foreign country, record at least one applicable section 72 route and the evidence supporting it:

1. the recipient is subject to a law, binding corporate rules, or binding agreement providing an adequate level of protection that effectively upholds substantially similar lawful-processing principles and onward-transfer protections;
2. the data subject consents to the transfer;
3. the transfer is necessary to perform a contract with the data subject or implement requested pre-contractual measures;
4. the transfer is necessary for a contract concluded in the data subject's interest; or
5. the transfer benefits the data subject, consent is not reasonably practicable to obtain, and the person would likely consent.

These are alternative statutory routes, but none should be selected without factual and legal evidence. A provider's GDPR claim, EU location, standard contractual clause, privacy policy, or consent checkbox does not automatically prove POPIA section 72 compliance.

## Current transfer map

| Flow                                                 | Confirmed facts                                                                                                                                                              | Unknowns/blockers                                                                                                                              | Status                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| South African tester → Supabase                      | Hosted Supabase receives Auth and detailed domain data when configured. Provider publishes region selection plus possible support/operational processing outside that region | Actual project region; backups, logs, support access; contracting entity/DPA; subprocessors; onward transfers; chosen section 72 ground        | **OWNER-DEPENDENT — not approved**                 |
| Supabase/Edge → Mailjet                              | Only explicit opt-in email delivery sends recipient address and generated content; default content is privacy-minimised                                                      | Actual account entity/DPA/subprocessors, support access, tracking settings, retention and section 72 assessment                                | **OWNER-DEPENDENT — not approved**                 |
| South African visitor → GitHub Pages                 | Static site is served by Pages; GitHub publishes that visitor IP addresses are logged for security                                                                           | Actual account/DPA coverage, processing/log locations, retention, subprocessors and section 72 basis                                           | **OWNER-DEPENDENT — not approved**                 |
| Developer/owner → GitHub repository and Actions      | Source, contributor identity, workflow metadata/artifacts and public build variables are processed; production financial records are not intended for source or CI           | Repository visibility, account entity/plan/DPA, log/artifact retention, developer locations and support transfers                              | **OWNER-DEPENDENT — not approved**                 |
| User → invited member/adviser/share recipient abroad | User may deliberately share scoped information with a recipient whose location is unknown                                                                                    | Recipient country/role, lawful basis, section 72 route, onward use and whether the product owner or user is the transferring responsible party | **CASE-SPECIFIC — guidance/legal review required** |
| User → downloaded export/device/cloud folder         | Browser creates a local download; the selected storage/sync service is outside application control                                                                           | Device/cloud location, recipient, security and further transfers                                                                               | **USER-DEPENDENT residual risk**                   |

Mailjet currently publishes storage in Frankfurt, Germany and Saint-Ghislain, Belgium. GitHub publishes multi-country processing, including the United States. Supabase publishes that the customer selects a project region but specified operational/support processing may occur elsewhere. These public statements do not establish the actual Buddy Budget contractual safeguards or all onward-processing locations.

## Approval worksheet

Complete separately for every provider and materially different flow:

- accountable responsible party and Information Officer;
- exporter, importer, recipients and their POPIA roles;
- countries for primary data, backup, logs, support, disaster recovery and subprocessors;
- data categories, sensitivity, volume, frequency, purpose and affected people;
- selected section 72 route with legal reasoning and evidence;
- applicable foreign law and practical access risks;
- written contractual/onward-transfer, technical and organisational safeguards;
- minimisation, encryption/access controls, retention and deletion;
- incident, rights-request, complaint and regulator cooperation;
- residual risk, approver, approval/expiry date and reassessment triggers.

Reassess on provider/subprocessor change, region migration, new data type, support access, incident, contract renewal, new public audience, or new recipient country. Keep the assessment with private contract evidence; publish only accurate high-level disclosures.

## Authoritative references

- [Protection of Personal Information Act 4 of 2013](https://www.gov.za/documents/protection-personal-information-act)
- [Supabase data residency and transfers](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
- [Mailjet storage-location statement](https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored)
- [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub privacy and international transfers](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

Provider sources were checked for factual inventory only. They are not South African legal approval.
