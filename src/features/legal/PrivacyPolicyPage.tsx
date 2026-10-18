import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/BrandMark';
import {
  isPrivacyPolicyPublishable,
  privacyPolicyMetadata,
  retrievePrivacyPolicyPublicationBlockers,
} from './privacyPolicy';
import { LegalLinks } from './LegalLinks';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-ZA', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );

export const PrivacyPolicyPage = () => {
  const blockers = retrievePrivacyPolicyPublicationBlockers();
  const isPublishable = isPrivacyPolicyPublishable();

  useEffect(() => {
    const previousTitle = document.title;
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = existingRobots?.content;
    const robots = existingRobots ?? document.head.appendChild(document.createElement('meta'));
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.title = 'Privacy Policy | Buddy Budget';
    return () => {
      document.title = previousTitle;
      if (!existingRobots) robots.remove();
      else robots.content = previousRobots ?? '';
    };
  }, []);

  return (
    <main className="legal-page">
      <header className="legal-page__header">
        <Link className="brand" to="/" aria-label="Buddy Budget home">
          <BrandMark />
          <strong>Buddy Budget</strong>
        </Link>
        <Link className="button button--ghost" to="/">
          <ArrowLeft aria-hidden="true" size={17} /> Back home
        </Link>
      </header>

      <article className="legal-document">
        <header className="legal-document__title">
          <p className="eyebrow">
            <ShieldCheck aria-hidden="true" size={16} /> Privacy and project status
          </p>
          <h1>Privacy Policy</h1>
          <p className="legal-document__lede">
            This notice explains how the current Buddy Budget test application handles personal and
            financial information, and where important facts still require owner approval.
          </p>
          <dl className="privacy-policy__metadata">
            <div>
              <dt>Version</dt>
              <dd>{privacyPolicyMetadata.version}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{isPublishable ? 'Approved and effective' : 'Draft — publication blocked'}</dd>
            </div>
            <div>
              <dt>{privacyPolicyMetadata.effectiveDate ? 'Effective' : 'Prepared'}</dt>
              <dd>
                <time
                  dateTime={
                    privacyPolicyMetadata.effectiveDate ?? privacyPolicyMetadata.preparedDate
                  }
                >
                  {formatDate(
                    privacyPolicyMetadata.effectiveDate ?? privacyPolicyMetadata.preparedDate,
                  )}
                </time>
              </dd>
            </div>
          </dl>
        </header>

        {!isPublishable && (
          <section className="privacy-policy__blocker" aria-labelledby="publication-blockers">
            <AlertTriangle aria-hidden="true" />
            <div>
              <h2 id="publication-blockers">Draft notice — not approved for final publication</h2>
              <p>
                The repository cannot verify the details below. The accountable owner must supply
                and approve them before this draft is presented as an effective privacy policy.
              </p>
              <ul>
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <nav className="privacy-policy__contents" aria-label="Privacy Policy contents">
          <strong>On this page</strong>
          <a href="#status">Project status</a>
          <a href="#responsible-party">Responsible party</a>
          <a href="#information">Information and purposes</a>
          <a href="#providers">Providers and transfers</a>
          <a href="#retention">Retention and deletion</a>
          <a href="#rights">Your rights and complaints</a>
          <a href="#children">Children</a>
          <a href="#security">Security</a>
          <a href="#changes">Changes</a>
        </nav>

        <section id="status">
          <h2>1. Project status and scope</h2>
          <p>
            Buddy Budget is an experimental, non-commercial project intended only for private
            development and authorised testing. It is not approved for public or commercial use.
            Testers choose whether to use it at their own discretion and risk and should not enter
            information they are not authorised to use.
          </p>
          <p>
            This status statement and any risk warning do not exclude, reduce, or override rights or
            duties under POPIA or any other applicable law. The source currently includes public
            registration and public utility routes, so the deployment owner must separately verify
            that access to any test environment is restricted as claimed.
          </p>
        </section>

        <section id="responsible-party">
          <h2>2. Responsible party and contact details</h2>
          <p>
            The legal name, physical address, jurisdiction, registered Information Officer, and
            monitored privacy contact have not been verified. This is a publication blocker. Do not
            treat “Buddy Budget” as the name of a confirmed legal entity or use this draft as a
            substitute for the responsible party's required details.
          </p>
        </section>

        <section id="information">
          <h2>3. Information, purposes, and proposed lawful grounds</h2>
          <p>The application is designed to process the following information:</p>
          <ul>
            <li>
              Account identity and access data, including email address, user identifier, session,
              verification, and recovery information, to authenticate and protect accounts.
            </li>
            <li>
              Profile and preference data, including display name, locale, currency, timezone, and
              notification choices, to configure the service.
            </li>
            <li>
              Financial planning data, including accounts, budgets, categories, transactions,
              imports, schedules, goals, rules, reports, adjustments, and historical snapshots, to
              provide the budgeting features selected by the tester.
            </li>
            <li>
              Collaboration and sharing data, including household membership, invitations, adviser
              grants, limited public snapshots, and activity records, to provide features
              deliberately enabled by a user.
            </li>
            <li>
              Operational records, including restore runs, notification deliveries, rate-limit
              records, and non-sensitive error state, to provide reliability, security, and abuse
              prevention.
            </li>
          </ul>
          <p>
            The likely grounds requiring owner and legal approval are performance of the service
            requested by a tester, compliance with applicable legal duties, legitimate interests in
            securing and operating a limited test, and consent for genuinely optional activities
            such as email check-ins. This is a draft mapping, not a final lawful-ground decision;
            consent is not assumed to be the ground for every activity.
          </p>
          <p>
            Demo and public calculator values remain in the browser until a visitor explicitly
            chooses to carry an approved plan into registration. Raw CSV files are parsed locally;
            accepted structured records are sent to the configured database. Free-text fields can
            contain information about other people, so testers should minimise names and sensitive
            details.
          </p>
        </section>

        <section id="providers">
          <h2>4. Providers, recipients, and international transfers</h2>
          <ul>
            <li>Supabase provides authentication, database, storage-related, and Edge services.</li>
            <li>GitHub Pages is configured to host the static web application.</li>
            <li>
              Mailjet receives an email address and generated message when an opted-in tester uses
              email check-ins.
            </li>
            <li>
              People chosen by a user may receive deliberately scoped household invitations, adviser
              access, shared reports, or shared template links.
            </li>
          </ul>
          <p>
            Provider roles, contracts, subprocessors, processing locations, and safeguards for
            transfers outside South Africa are not established by this repository. They must be
            verified for each deployment before this policy becomes effective.
          </p>
        </section>

        <section id="retention">
          <h2>5. Retention, account deletion, and local storage</h2>
          <p>
            Some invitations, sharing links, adviser grants, and transfer payloads expire, but
            expiry does not necessarily erase the underlying server record. Financial history may be
            archived or locked to preserve report integrity. Self-service account deletion removes
            the eligible Auth identity and account-owned records from the active database. It is
            blocked where deleting an owner could orphan a shared household. It does not promise
            immediate deletion from provider backups or logs, another person's downloaded copy, or
            records that must first be handled through the shared-household workflow.
          </p>
          <p>
            No approved record-by-record retention schedule exists. That schedule must define
            deletion or anonymisation, legal holds, logs, backups, public snapshots, notification
            records, restore snapshots, and activity history before final publication. Browser
            storage is used for sessions, preferences, PWA assets, and short-lived approved
            demo/calculator transfer state. Successful deletion clears account-scoped application
            cache and browser state where the browser permits it; testers using shared devices
            should still close the application and clear site data if cleanup reports a problem.
          </p>
        </section>

        <section id="rights">
          <h2>6. Your rights and complaints</h2>
          <p>
            Subject to applicable law, people may have rights to ask whether their information is
            held, request access or correction, ask for deletion where permitted, object to certain
            processing, and complain about unlawful processing. In-app editing, export, and account
            deletion support some of these actions but are not a complete rights-request process.
          </p>
          <p>
            A verified request channel and identity-checking procedure are still required. Until
            those are approved, do not send identity documents or sensitive financial data to an
            unverified project address. A complaint may also be submitted to South Africa's{' '}
            <a href="https://inforegulator.org.za/complaints/">Information Regulator</a>. Nothing in
            this draft limits the right to approach the Regulator or another competent authority.
          </p>
        </section>

        <section id="children">
          <h2>7. Children and sensitive information</h2>
          <p>
            Buddy Budget is not designed to collect children's information or special personal
            information. However, the current public registration flow does not enforce an age rule,
            and free-text fields can contain sensitive information. The owner must approve a minimum
            age and either implement an adults-only control or obtain legal review and appropriate
            authority before any processing of children's information.
          </p>
        </section>

        <section id="security">
          <h2>8. Security</h2>
          <p>
            The repository includes authenticated access, PostgreSQL row-level security, household
            role checks, scoped caches, hashed and expiring public tokens, server-side provider
            secrets, local import parsing, and privacy-minimised sharing and email defaults. These
            controls reduce risk but cannot guarantee absolute security.
          </p>
          <p>
            Production settings, backups, provider access, logging, incident response, and deployed
            security headers are outside the repository and remain subject to verification. Do not
            use this draft as evidence that a particular deployment has passed a security or legal
            review.
          </p>
        </section>

        <section id="changes">
          <h2>9. Changes to this notice</h2>
          <p>
            Material changes must receive a new version and effective date. The owner should notify
            affected testers before materially different processing begins and retain prior approved
            versions. Version {privacyPolicyMetadata.version} is a draft prepared on{' '}
            {formatDate(privacyPolicyMetadata.preparedDate)} and has no effective date.
          </p>
        </section>

        <footer className="privacy-policy__sources">
          <h2>Authoritative references</h2>
          <p>
            This draft is informed by the repository's verified data inventory and the official{' '}
            <a href="https://www.gov.za/documents/protection-personal-information-act">
              Protection of Personal Information Act 4 of 2013
            </a>
            . Legal applicability and final wording require qualified review.
          </p>
          <LegalLinks />
        </footer>
      </article>
    </main>
  );
};
