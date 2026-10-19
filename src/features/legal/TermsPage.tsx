import { AlertTriangle } from 'lucide-react';
import { LegalPageShell } from './LegalPageShell';

export const TermsPage = () => (
  <LegalPageShell
    title="Terms of Use"
    eyebrow="Draft terms for authorised testing"
    summary="These draft terms describe the intended limits of the private Buddy Budget test project. They are not effective or approved terms yet."
  >
    <section className="legal-document__warning" aria-labelledby="terms-publication-blockers">
      <AlertTriangle aria-hidden="true" />
      <div>
        <h2 id="terms-publication-blockers">Draft — publication and acceptance blocked</h2>
        <p>
          The accountable owner and legal reviewer must confirm the operator identity, service and
          complaints contact, eligible tester rules, governing law and forum, approval date, and
          effective date. No tester should be asked to accept this draft as a binding agreement.
        </p>
      </div>
    </section>

    <section>
      <h2>1. Experimental project and eligible use</h2>
      <p>
        Buddy Budget is an experimental, non-commercial project for private development and
        authorised testing only. It is not approved for public or commercial use. Access to a
        publicly reachable page or registration form does not make a person an authorised tester and
        does not make the deployment private.
      </p>
      <p>
        Testers may use the project only for the test purpose communicated by the person who invited
        them and must follow applicable law and reasonable security instructions.
      </p>
    </section>

    <section>
      <h2>2. Accounts and authority</h2>
      <p>
        Testers must provide accurate account information, protect their credentials, and promptly
        report suspected unauthorised access through a verified channel once one is published. A
        tester may enter, import, share, or invite access to information only when authorised to do
        so. Household, adviser, report, and template links must be shared only with intended
        recipients.
      </p>
    </section>

    <section>
      <h2>3. Financial information and calculations</h2>
      <p>
        Buddy Budget is a planning and record-keeping tool. It does not provide financial, tax,
        investment, credit, legal, or debt-counselling advice and does not recommend or transact in
        financial products. Calculations, forecasts, imported data, categorisation, reports, and
        recommendations may be incomplete, delayed, or inaccurate.
      </p>
      <p>
        Testers must verify important amounts, dates, classifications, exports, and decisions
        against source records and obtain appropriately qualified advice where needed. A “not
        financial advice” label does not change the legal character of any future regulated
        activity.
      </p>
    </section>

    <section>
      <h2>4. Test data and privacy</h2>
      <p>
        Avoid real sensitive financial, identity, children’s, special personal, confidential, or
        third-party information during testing. Use fictional or minimised data wherever possible.
        If real information is expressly authorised for a test, use only what is necessary and
        follow the Privacy Policy and the test owner’s instructions.
      </p>
    </section>

    <section>
      <h2>5. Acceptable use</h2>
      <p>Testers must not:</p>
      <ul>
        <li>attempt to access another person’s account, household, report, or data;</li>
        <li>bypass access controls, rate limits, revocation, or expiry;</li>
        <li>introduce malicious code, disrupt the service, or test security without permission;</li>
        <li>use the project for unlawful, misleading, commercial, or regulated activity; or</li>
        <li>
          present test output as verified professional advice or an official financial record.
        </li>
      </ul>
    </section>

    <section>
      <h2>6. Availability, changes, and test closure</h2>
      <p>
        Test features may change, fail, or be withdrawn. Test access may be paused or ended to
        protect people, data, or the project. Where reasonably possible, testers should export any
        permitted data they need before a notified test closure. No unverified promise is made about
        availability, backup recovery, or permanent retention.
      </p>
    </section>

    <section>
      <h2>7. Responsibility and statutory rights</h2>
      <p>
        Testers use the experimental project at their own discretion and risk and remain responsible
        for verifying results and protecting exported or shared information. To the extent permitted
        by applicable law, the project is provided for evaluation without a promise that it will be
        uninterrupted, error-free, or suitable for a particular purpose.
      </p>
      <p>
        Nothing in these draft terms excludes or restricts any right, remedy, duty, or liability
        that applicable law does not allow to be excluded or restricted. In particular, this wording
        does not waive rights that may apply under POPIA, ECTA, the Consumer Protection Act, or
        other law, and it does not excuse negligence or unlawful conduct where liability cannot
        legally be limited.
      </p>
    </section>

    <section>
      <h2>8. Electronic transactions and consumer-law position</h2>
      <p>
        Electronic communications and actions can have legal effect. ECTA supplier disclosures and
        consumer-transaction duties may apply if the project offers goods or services for sale,
        hire, or exchange online. The current repository does not verify the operator information
        needed for those disclosures.
      </p>
      <p>
        The Consumer Protection Act position is conditional on the actual supply and operating
        context. If the project is promoted, supplied, or monetised in the ordinary course of
        business, the owner must obtain legal review and implement fair terms, disclosures,
        complaints, and redress. Calling the project experimental or free does not by itself decide
        applicability.
      </p>
    </section>

    <section>
      <h2>9. Changes to these terms</h2>
      <p>
        Material changes require a new version, owner and legal approval, an effective date, and
        appropriate notice to affected testers. Draft version 0.1 was prepared on 16 October 2026
        and has no effective date.
      </p>
    </section>

    <section className="legal-document__sources">
      <h2>Authoritative references</h2>
      <p>
        Applicability was checked against the official{' '}
        <a href="https://www.gov.za/documents/electronic-communications-and-transactions-act">
          Electronic Communications and Transactions Act 25 of 2002
        </a>{' '}
        and{' '}
        <a href="https://www.gov.za/documents/consumer-protection-act">
          Consumer Protection Act 68 of 2008
        </a>
        . Final terms require qualified South African legal review.
      </p>
    </section>
  </LegalPageShell>
);
