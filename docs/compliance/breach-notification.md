# POPIA section 22 notification procedure

Reviewed on 18 October 2026 against the Protection of Personal Information Act 4 of 2013 and current Information Regulator material. This procedure requires owner and South African legal/privacy review; it does not decide a real incident in advance.

## Current authoritative position

Section 22 applies where there are reasonable grounds to believe that a data subject's personal information has been accessed or acquired by an unauthorised person. The responsible party must notify the Information Regulator and affected data subjects as soon as reasonably possible after discovery, subject to the statutory law-enforcement-delay route. The Act does not state a fixed number of hours.

The Information Regulator's current guidance says:

- the responsible party retains reporting responsibility when an operator discovers the compromise;
- all security compromises meeting the section 22 condition must be reported regardless of assessed risk;
- data subjects should be notified unless their identities cannot be established, subject to a permitted delay;
- the responsible party must investigate nature, scope, affected information, affected people, likely consequences, and mitigation; and
- from 1 April 2025, security-compromise reports are submitted through the Regulator's eServices portal.

Authoritative references checked:

- [POPIA, including section 22](https://www.gov.za/documents/protection-personal-information-act)
- [Information Regulator POPIA guidance and reporting process](https://inforegulator.org.za/popia/)
- [Information Regulator security-compromise fact sheet](https://inforegulator.org.za/2025/08/19/fact-sheet-handling-of-security-compromises/)
- [Information Regulator eServices portal](https://eservices.inforegulator.org.za/services.aspx)

Recheck the live Regulator pages and portal at incident time. Do not rely solely on a cached form, old email address, or this repository.

## Decision path

1. **Is personal information involved?** Use the verified [data inventory](data-inventory.md). If no, document evidence and manage as a security/reliability incident.
2. **Are there reasonable grounds to believe it was accessed or acquired by an unauthorised person?** Consider confirmed access, exposed credentials plus access evidence, provider notification, broken RLS with reachable records, recipient misdirection, and unexplained authenticated activity. Lack of complete scope is not a reason to postpone escalation or evidence preservation.
3. **If yes, treat it as reportable.** Do not apply an internal “low risk means no report” threshold. Open the Regulator eServices process and prepare data-subject notification.
4. **If facts are not yet sufficient, keep the assessment active.** Record what is known, missing evidence, owner, next check, and time. Contain and investigate promptly; do not use uncertainty to create an unofficial waiting period.
5. **Check only the statutory delay route.** Notification may be delayed where the relevant public body responsible for prevention, detection, or investigation of offences, or the Regulator, determines that notification will impede a criminal investigation. Record the authority, instruction, scope, and dates. Internal preference, reputational concern, or incomplete remediation is not this determination.

No automated code path in Buddy Budget makes this legal decision or sends these notifications.

## Regulator notification packet

The Information Officer/Deputy or other authorised reporter must verify the portal's current required fields. Prepare at least:

- verified responsible-party and Information Officer details;
- discovery date/time, incident date/time or best-known range, and explanation of uncertainty;
- incident type, description, affected system/provider/environment, and containment status;
- categories of personal information and estimated/confirmed number of affected data subjects;
- possible consequences and measures already taken or planned;
- whether/how affected data subjects were notified, or why identity cannot be established;
- any authorised notification delay and its basis;
- safe contact route for follow-up; and
- supporting annexure stripped of credentials and unnecessary financial payloads.

Save the portal acknowledgement/reference, submitted version, submission time, submitter, and follow-up correspondence in the restricted incident record. Filing must not wait for perfect forensic certainty when the statutory condition is already met; label estimates and submit corrections or supplementary information through the current Regulator process as advised.

## Data-subject notice

Use plain language and enough information for protective action. Section 22 requires the notice to describe possible consequences, measures taken or intended, a recommendation about measures the person can take, and, if known, the identity of the unauthorised person who may have accessed or acquired the information.

Include:

- what happened and when it was discovered, separating confirmed facts from investigation;
- what information and service scope are affected, without revealing another person's information;
- likely consequences without minimising or exaggerating them;
- containment and remediation performed or underway;
- specific protective steps, such as changing a reused password, reviewing account activity, or distrusting a compromised share link, only when relevant;
- the monitored incident/privacy contact and Regulator complaint route; and
- when the next update will be provided, if investigation continues.

The Act permits written notice by post, email, prominent website placement, news media, or another method directed by the Regulator. Choose an effective, proportionate method based on verified contact data and Regulator direction. A public website banner must not expose names, account status, financial values, or the fact that a particular person is affected.

## Decision record

For every suspected privacy incident, record:

| Field                           | Required entry                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Incident ID and assessor        | Restricted identifier; accountable decision maker                                 |
| Facts and evidence              | CONFIRMED, LIKELY, POSSIBLE; evidence locations and collection times              |
| Personal information and people | Data categories, estimated/confirmed count, ability to identify affected subjects |
| Section 22 condition            | Met, not met, or assessment active, with reasons and review time                  |
| Regulator action                | Portal reference and time, or evidence supporting why section 22 was not met      |
| Data-subject action             | Method/time/content, identity unavailable, or documented authorised delay         |
| Follow-up                       | Corrections, provider responses, protective support, owner and due date           |

The owner must approve the responsible party, registered Information Officer, monitored privacy/incident contact, alternates, and portal access before deployment. These remain unresolved in `OD-001`, `OD-009`, and `OD-011`.
