import { ArrowRight, CalendarCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/BrandMark';

export const LandingPage = () => (
  <main className="landing">
    <header className="landing__header">
      <Link className="brand" to="/">
        <BrandMark />
        <strong>Buddy Budget</strong>
      </Link>
      <div className="landing__actions">
        <Link className="button button--ghost" to="/auth/sign-in">
          Sign in
        </Link>
        <Link className="button button--primary" to="/auth/register">
          Start budgeting
        </Link>
      </div>
    </header>
    <section className="hero">
      <div className="hero__copy">
        <p className="eyebrow">
          <Sparkles aria-hidden="true" size={16} /> A calmer way to budget
        </p>
        <h1>
          Your month.
          <br />
          <em>Under control.</em>
        </h1>
        <p>
          Turn your recurring plan into a fresh monthly budget, adjust what changed, and see exactly
          what remains.
        </p>
        <div className="hero__actions">
          <Link className="button button--primary button--large" to="/auth/register">
            Create your first budget <ArrowRight aria-hidden="true" size={19} />
          </Link>
          <Link className="button button--secondary button--large" to="/auth/sign-in">
            I already have an account
          </Link>
        </div>
        <div className="trust-points">
          <span>
            <ShieldCheck aria-hidden="true" /> Private by design
          </span>
          <span>
            <CalendarCheck aria-hidden="true" /> History stays unchanged
          </span>
        </div>
      </div>
      <div className="hero-budget" aria-label="Example monthly budget">
        <div className="hero-budget__top">
          <span>September 2026</span>
          <small>Saved</small>
        </div>
        <div className="hero-budget__remaining">
          <small>Remaining</small>
          <strong>R 8,420.00</strong>
          <span>18.7% savings rate</span>
        </div>
        <div className="hero-budget__totals">
          <span>
            <small>Income</small>
            <strong>R 45,000</strong>
          </span>
          <span>
            <small>Expenses</small>
            <strong>R 36,580</strong>
          </span>
        </div>
        <div className="hero-budget__rows">
          <span>
            <i>H</i>Rent <b>R 14,500</b>
          </span>
          <span>
            <i>G</i>Groceries <b>R 5,200</b>
          </span>
          <span>
            <i>T</i>Transport <b>R 2,800</b>
          </span>
        </div>
      </div>
    </section>
  </main>
);
