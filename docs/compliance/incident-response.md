# Incident response playbook

Reviewed on 18 October 2026. This is an operational readiness document, not legal advice, evidence of a completed exercise, or proof that production monitoring is configured.

## Scope and verified capability

Use this playbook for suspected loss, unauthorised access or acquisition, disclosure, alteration, destruction, credential exposure, broken access control, malicious activity, or provider compromise involving Buddy Budget information. A reliability incident becomes a privacy incident when personal information may be affected.

Repository review found no centralized telemetry, SIEM, third-party analytics, or automated regulator reporting. Available signals are limited to:

- Supabase Auth, database, Edge Function, and project logs available under the deployed plan and configuration;
- GitHub security, secret-scanning, dependency, workflow, and deployment results;
- Mailjet delivery, bounce, block, and account-security information available to the account owner;
- bounded `notification_deliveries` failure state, household activity, adviser access events, and application error reports; and
- reports from authorised testers, recipients, providers, or researchers.

Do not claim continuous detection. Production log availability, retention, alerting, time synchronisation, and access roles must be verified before deployment.

## Roles and contact tree

The owner must replace the role assignments below in a private operations record. Do not put personal telephone numbers, private email addresses, credentials, or provider tokens in this repository.

| Role                          | Responsibility                                                                                        | Required evidence                                              | Current state                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| Incident lead                 | Opens the incident record, coordinates containment, owns the timeline and handover                    | Named primary and alternate; monitored route; after-hours rule | **Unverified — release blocker** |
| Information Officer or Deputy | Decides and submits POPIA section 22 notifications for the responsible party                          | Registered/authorised person, portal access, alternate         | **Unverified — release blocker** |
| Technical lead                | Preserves evidence, contains systems, rotates credentials, validates recovery                         | Supabase, GitHub, hosting and Mailjet access                   | **Unverified**                   |
| Legal/privacy reviewer        | Reviews whether facts establish a security compromise and checks notification content or lawful delay | Named reviewer and escalation route                            | **Unverified**                   |
| Communications owner          | Delivers approved, accessible data-subject notices and handles replies                                | Monitored sender and support channel                           | **Unverified**                   |

The incident lead may coordinate work but may not suppress a required notification. The responsible party retains section 22 responsibility when an operator such as Supabase, GitHub, or Mailjet reports an incident.

## Severity and first response

Severity prioritises response; it does not decide whether section 22 reporting is required.

| Severity | Example                                                                                                                               | Initial action                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| P0       | Active cross-household access, service-role or database credential exposure, bulk personal-information access, destructive compromise | Page incident lead and technical lead immediately; stop affected processing if safe |
| P1       | Confirmed unauthorised access with limited scope, exposed share token with evidence of access, compromised tester account             | Contain urgently; start section 22 assessment and provider escalation               |
| P2       | Credible suspicious activity without confirmed access, lost test export, provider warning                                             | Preserve evidence, validate scope, raise severity when facts justify it             |
| P3       | Security control weakness with no indication personal information was accessed or acquired                                            | Remediate and record; reassess if new evidence appears                              |

For every severity:

1. Open an incident identifier such as `BB-INC-YYYY-NNN` in the approved restricted incident register.
2. Record discovery time, reporter, affected environment, initial facts, uncertainty, systems, data classes, and actions. Use UTC plus the local timezone.
3. Preserve volatile evidence before changing systems where safe. Record who collected it, when, source, hash where appropriate, and every transfer.
4. Contain using the least destructive effective action: revoke sessions or grants, revoke shared links, disable a function or deployment, pause email delivery, restrict signup, rotate a confirmed secret, or isolate the affected project.
5. Do not delete accounts, logs, tables, branches, provider projects, or backups merely to conceal or clean up the incident. Preserve originals and work from copies.
6. Start the [section 22 decision path](breach-notification.md) as soon as personal information may have been accessed or acquired by an unauthorised person.
7. Keep a decision and action log. Record facts separately from assumptions and mark CONFIRMED, LIKELY, or POSSIBLE.

## Evidence preservation

Collect only what is necessary. Restrict access to the response team and never paste evidence into public issues, pull requests, chat, screenshots, or this repository.

- Export relevant provider audit/log records using provider-supported methods; record the query/filter and displayed timezone.
- Preserve the deployed commit SHA, workflow run, migration state, Edge Function version, configuration inventory, and incident-related request IDs.
- Preserve affected row identifiers and bounded metadata where necessary; avoid copying complete financial payloads or tokens.
- Redact access tokens, refresh tokens, passwords, service-role keys, database connection strings, raw exports, email bodies, and financial values from working notes unless indispensable to the investigation.
- Store originals read-only where possible. Record hashes for downloaded files and retain a chain-of-custody log.
- Agree incident-record retention and legal-hold handling under `OD-008` and `OD-011`; do not invent or apply an unapproved period.

## Containment and recovery checks

- **Supabase:** inspect Auth/project/database/Edge logs; revoke affected sessions; rotate only compromised secrets; review RLS and grants; do not rotate the public publishable key as if it were a secret.
- **GitHub/Pages:** disable a compromised deployment or workflow, revoke affected credentials, inspect workflow and repository audit evidence available to the plan, and preserve the implicated commit.
- **Mailjet:** pause Buddy Budget dispatch where necessary, rotate compromised API credentials, check account/activity and delivery evidence, and preserve provider case references.
- **Public links/adviser grants:** revoke implicated report/template tokens or adviser grants and verify anonymous or removed-user access fails immediately.
- **Browser/PWA:** advise affected testers to sign out and clear site data only when relevant; do not represent client cleanup as server containment.

Recovery requires validation in a non-production environment where practical, fresh authorization tests, secret scanning, database/RLS tests, and confirmation that the original attack path is closed. Monitor the restored service for recurrence. The incident lead records the recovery decision, residual risk, and rollback option.

## Provider escalation record

Use authenticated provider support channels and status pages current at incident time. Record the provider, case/reference number, UTC submission time, reporter, facts supplied, requested action, response, and next follow-up. Do not send providers more personal information than necessary.

Provider contract, plan, region, support entitlement, security contact, log retention, and notification commitments remain unverified under `OD-004`. Status pages are availability signals, not proof that Buddy Budget data was or was not affected.

## Closure and learning

Close only after containment and recovery are verified, the section 22 decision and notifications are recorded, affected people have a monitored reply route, provider actions are tracked, and follow-up owners/dates exist. Produce a redacted lessons-learned record covering root cause, control failures, detection delay, notification handling, corrective actions, and evidence gaps. Never include private payloads in a public post-incident report.

Run the [incident exercise](incident-exercise.md) after material architecture/provider changes and at an owner-approved cadence. A document review is not a completed exercise.
