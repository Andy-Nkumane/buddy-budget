import { LegalPageShell } from './LegalPageShell';

export const FinancialDisclaimerPage = () => (
  <LegalPageShell
    title="Financial Information Disclaimer"
    eyebrow="Verify before acting"
    summary="Buddy Budget helps testers organise information. It is not a substitute for source records or qualified professional advice."
  >
    <section>
      <h2>What Buddy Budget does</h2>
      <p>
        Buddy Budget calculates and displays values from information entered, imported, or linked by
        a tester. It may show plans, actual-versus-planned differences, forecasts, savings rates,
        goal progress, trends, and deterministic suggested actions.
      </p>
    </section>
    <section>
      <h2>What it does not do</h2>
      <p>
        The project does not provide financial, investment, tax, accounting, credit, legal, or
        debt-counselling advice. It does not assess suitability, guarantee an outcome, recommend a
        financial product, move money, or replace professional judgement.
      </p>
    </section>
    <section>
      <h2>Calculations can be wrong</h2>
      <p>
        Results may be inaccurate because of input mistakes, incomplete or delayed data, rounding,
        currency limitations, software defects, changed assumptions, or misunderstood categories.
        Forecasts and trends describe available data; they do not predict future results.
      </p>
      <p>
        Verify important values and dates against bank statements, invoices, contracts, tax records,
        and other authoritative sources before making a decision. Seek an appropriately qualified
        professional when advice is needed.
      </p>
    </section>
    <section>
      <h2>Use safe test data</h2>
      <p>
        Buddy Budget is limited to authorised testing. Avoid real sensitive financial, identity,
        children’s, confidential, or third-party information. Prefer fictional or minimised data and
        never upload credentials, access codes, identity documents, or provider secrets.
      </p>
    </section>
    <section>
      <h2>Your legal rights remain</h2>
      <p>
        Use of the experimental project is at the tester’s discretion and risk, but this disclaimer
        does not exclude or reduce rights, remedies, duties, or liability that cannot lawfully be
        excluded or reduced. A disclaimer also does not change whether future conduct is regulated.
      </p>
    </section>
  </LegalPageShell>
);
