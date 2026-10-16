import { AlertTriangle } from 'lucide-react';
import { LegalPageShell } from './LegalPageShell';

export const ContactPage = () => (
  <LegalPageShell
    title="Contact"
    eyebrow="Verified channels only"
    summary="No official Buddy Budget operator, support address, privacy address, or complaints channel has been verified for publication."
  >
    <section className="legal-document__warning" aria-labelledby="contact-blocker">
      <AlertTriangle aria-hidden="true" />
      <div>
        <h2 id="contact-blocker">Contact publication blocker</h2>
        <p>
          Do not send passwords, access links, identity documents, bank statements, exports, or
          sensitive financial information to an address claiming to represent Buddy Budget unless
          the accountable owner has verified that channel.
        </p>
      </div>
    </section>
    <section>
      <h2>Testing questions</h2>
      <p>
        Until an approved channel is published, authorised testers should use the existing verified
        channel through which the test invitation was issued. That invitation channel is not
        represented here as an official legal, privacy, or complaints address.
      </p>
    </section>
    <section>
      <h2>Privacy complaints</h2>
      <p>
        The missing project contact does not limit a person’s right to approach South Africa’s{' '}
        <a href="https://inforegulator.org.za/complaints/">Information Regulator</a> about a matter
        within its jurisdiction.
      </p>
    </section>
    <section>
      <h2>Consumer complaints</h2>
      <p>
        If the Consumer Protection Act applies to the actual supply, consumers may obtain
        information about complaints from the{' '}
        <a href="https://thencc.org.za/complaints/">National Consumer Commission</a>. Linking to a
        regulator does not concede or deny jurisdiction and does not replace the project owner’s
        obligation to establish an appropriate complaints process where required.
      </p>
    </section>
  </LegalPageShell>
);
