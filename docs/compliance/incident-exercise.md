# Incident tabletop exercise

This runbook tests decisions and coordination without changing production, contacting real data subjects, submitting a real regulator report, rotating live secrets, or using real financial data.

## Exercise record

| Field                                                                                            | Entry                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Exercise ID                                                                                      | `BB-TTX-YYYY-NNN`                                  |
| Date, start/end time, timezone                                                                   |                                                    |
| Facilitator and note taker                                                                       |                                                    |
| Incident lead, Information Officer/Deputy, technical, legal/privacy, communications participants |                                                    |
| Environment and provider representatives                                                         |                                                    |
| Scenario version                                                                                 |                                                    |
| Result                                                                                           | Not run / completed with actions / repeat required |

Do not mark the exercise completed until participants have met, worked through every inject, recorded decisions, and assigned remediation.

## Scenario

An authorised tester reports seeing another household's budget summary after switching households. Shortly afterwards, a GitHub secret scan reports a string resembling a service credential in a committed troubleshooting document. Supabase logs are available but their timezone and retention have not been recorded. The report arrives outside normal working hours, and the primary technical contact does not respond.

Use synthetic identifiers and values only. The facilitator releases injects in sequence:

1. A screenshot appears to contain category names and aggregated values from a second household.
2. The reporter says they refreshed twice and then signed out; the URL and exact time are known.
3. The suspected credential is confirmed to be a service-role key, but there is no proof yet that it was used.
4. Database evidence shows requests from an unfamiliar address using elevated credentials.
5. Supabase support acknowledges a case; the affected-row count is still an estimate.
6. Affected tester email addresses are available, while the responsible party and registered Information Officer records are incomplete.

## Expected actions

Participants must demonstrate, verbally or in an isolated staging environment:

- opening an incident record and classifying facts versus assumptions;
- contacting the alternate when the primary does not respond;
- preserving the report, commit SHA, provider logs, timestamps, configuration and chain of custody without copying unnecessary financial data;
- disabling or containing the affected path and revoking the confirmed secret without deleting evidence;
- distinguishing a public publishable key from an actual secret;
- testing cross-household access after containment;
- escalating through authenticated Supabase and GitHub support/security channels and recording case references;
- applying the [section 22 decision path](breach-notification.md) without inventing a risk threshold or notification deadline;
- drafting a regulator packet and data-subject notice with synthetic data, without submitting or sending either; and
- defining recovery evidence, monitoring, follow-up, and a safe rollback.

## Evaluation checklist

- [ ] Primary and alternate contacts were reachable through a tested private contact tree.
- [ ] Someone with authority accepted the incident-lead role.
- [ ] Information Officer/Deputy and portal-access ownership were verified.
- [ ] Provider support entitlement and escalation routes were accessible.
- [ ] Log sources, timezone, retention, access permissions, and export method were known.
- [ ] Evidence was minimised, access-controlled, and traceable.
- [ ] Containment stopped the simulated exposure without destructive evidence loss.
- [ ] RLS/cross-household and secret-scan checks formed part of recovery.
- [ ] The section 22 decision cited facts and current official guidance.
- [ ] Draft notices contained protective actions and no unrelated financial details.
- [ ] Every gap has a severity, owner, target date, verification step, and rollback consideration.

## After-action report

Within the owner-approved internal period, record:

1. What was detected, by which signal, and what was missed.
2. Response timeline and decision bottlenecks.
3. Contact, provider, access, log-retention, evidence, notification, and recovery gaps.
4. Corrective actions with priority, owner, due date, dependency, and verification.
5. Whether the playbooks or owner decisions need revision.
6. A target date for the repeat exercise.

Store the completed record in an approved restricted location, not in the public repository if it contains names, contacts, provider account details, system identifiers, or security weaknesses. Add only a redacted completion date and high-level outcome to compliance evidence.
