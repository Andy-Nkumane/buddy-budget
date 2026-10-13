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
  const [milestone, setMilestone] = useState<ActivationMilestoneKey | null>(() =>
    takePendingMilestone(),
  );

  useEffect(() => {
    const receive = (event: Event) => {
      const key = (event as CustomEvent<ActivationMilestoneKey>).detail;
      const pending = takePendingMilestone();
      if (key in milestoneDetails) setMilestone(pending ?? key);
    };
    window.addEventListener(milestoneEventName, receive);
    return () => window.removeEventListener(milestoneEventName, receive);
  }, []);

  if (!milestone) return null;
  const detail = milestoneDetails[milestone];
  return (
    <aside className="milestone-notice" aria-label="Completed milestone" aria-live="polite">
      <CheckCircle2 aria-hidden="true" size={22} />
      <div>
        <strong>{detail.title}</strong>
        <p>{detail.message}</p>
      </div>
      <Link
        className="button button--secondary"
        to={detail.path}
        onClick={() => setMilestone(null)}
      >
        {detail.action}
      </Link>
      <button
        aria-label="Dismiss milestone"
        className="icon-button"
        type="button"
        onClick={() => setMilestone(null)}
      >
        <X aria-hidden="true" size={18} />
      </button>
    </aside>
  );
};
