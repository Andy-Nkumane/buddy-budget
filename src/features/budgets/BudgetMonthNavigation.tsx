import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { adjacentMonthStart, formatMonth } from '../../shared/formatting/money';

export const BudgetMonthNavigation = ({
  monthStart,
  locale,
}: {
  monthStart: string;
  locale?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div className="page-heading budget-heading">
      <div>
        <p className="eyebrow">Monthly budget</p>
        <h1>{formatMonth(monthStart, locale)}</h1>
      </div>
      <nav className="month-switcher" aria-label="Budget month">
        <button
          className="icon-button"
          aria-label="Previous month"
          onClick={() => void navigate(`/app/budget/${adjacentMonthStart(monthStart, -1)}`)}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          className="month-switcher__current"
          onClick={() => void navigate('/app/budget/current')}
        >
          This month
        </button>
        <button
          className="icon-button"
          aria-label="Next month"
          onClick={() => void navigate(`/app/budget/${adjacentMonthStart(monthStart, 1)}`)}
        >
          <ArrowRight aria-hidden="true" />
        </button>
        <Link className="text-button" to="/app/months">
          View budget months
        </Link>
      </nav>
    </div>
  );
};
