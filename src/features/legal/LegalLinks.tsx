import { Link } from 'react-router-dom';

export const LegalLinks = () => (
  <nav className="legal-links" aria-label="Legal and contact information">
    <Link to="/privacy">Privacy</Link>
    <Link to="/terms">Terms</Link>
    <Link to="/disclaimer">Disclaimer</Link>
    <Link to="/contact">Contact</Link>
  </nav>
);
