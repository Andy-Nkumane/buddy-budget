import { Link, Outlet } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/BrandMark';

export const AuthLayout = () => (
  <main className="auth-shell">
    <section className="auth-brand-panel">
      <Link className="brand brand--light" to="/">
        <BrandMark />
        <strong>Buddy Budget</strong>
      </Link>
      <div className="auth-brand-panel__message">
        <p className="eyebrow">Simple monthly planning</p>
        <h1>
          Your month.
          <br />
          Under control.
        </h1>
        <p>Build your recurring plan once, adjust each month, and always know what remains.</p>
      </div>
      <div className="auth-preview" aria-hidden="true">
        <span>September overview</span>
        <strong>R 8,420 remaining</strong>
        <div>
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
    <section className="auth-form-panel">
      <Outlet />
    </section>
  </main>
);
