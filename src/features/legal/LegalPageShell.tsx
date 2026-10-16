import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/BrandMark';
import { LegalLinks } from './LegalLinks';

type LegalPageShellProps = {
  title: string;
  eyebrow: string;
  summary: string;
  children: ReactNode;
};

export const LegalPageShell = ({ title, eyebrow, summary, children }: LegalPageShellProps) => {
  useEffect(() => {
    const previousTitle = document.title;
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = existingRobots?.content;
    const robots = existingRobots ?? document.head.appendChild(document.createElement('meta'));
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.title = `${title} | Buddy Budget`;
    return () => {
      document.title = previousTitle;
      if (!existingRobots) robots.remove();
      else robots.content = previousRobots ?? '';
    };
  }, [title]);

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
            <Scale aria-hidden="true" size={16} /> {eyebrow}
          </p>
          <h1>{title}</h1>
          <p className="legal-document__lede">{summary}</p>
        </header>
        {children}
        <footer className="legal-document__navigation">
          <strong>Legal and contact information</strong>
          <LegalLinks />
        </footer>
      </article>
    </main>
  );
};
