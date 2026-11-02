import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  milestoneDetails,
  milestoneEventName,
  takePendingMilestone,
  type ActivationMilestoneKey,
} from './milestones';

export const MilestoneNotice = () => {
  const [milestone, setMilestone] = useState<ActivationMilestoneKey | null>(null);

  useEffect(() => {
    let active = true;
    const receive = (event: Event) => {
      const key = (event as CustomEvent<ActivationMilestoneKey>).detail;
      const pending = takePendingMilestone();
      if (pending) setMilestone(pending);
      else if (typeof key === 'string' && key in milestoneDetails) setMilestone(key);
    };
    window.addEventListener(milestoneEventName, receive);
    queueMicrotask(() => {
      if (!active) return;
      const pending = takePendingMilestone();
      if (pending) setMilestone(pending);
    });
    return () => {
      active = false;
      window.removeEventListener(milestoneEventName, receive);
    };
  }, []);

  if (!milestone) return null;
  const detail = milestoneDetails[milestone];
  return (
    <aside className="milestone-notice" aria-label="Completed milestone" aria-live="polite">
      <CheckCircle2 className="milestone-notice__icon" aria-hidden="true" size={22} />
      <div className="milestone-notice__content">
        <strong>{detail.title}</strong>
        <p>{detail.message}</p>
      </div>
      <Link
        className="button button--secondary milestone-notice__action"
        to={detail.path}
        onClick={() => setMilestone(null)}
      >
        {detail.action}
      </Link>
      <button
        aria-label="Dismiss milestone"
        className="icon-button milestone-notice__dismiss"
        type="button"
        onClick={() => setMilestone(null)}
      >
        <X aria-hidden="true" size={18} />
      </button>
    </aside>
  );
};
