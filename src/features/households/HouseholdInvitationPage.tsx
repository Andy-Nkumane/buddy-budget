import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { respondToHouseholdInvitation } from '../../data/repositories/householdRepository';
import { Button } from '../../shared/ui/Button';

export const HouseholdInvitationPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = params.get('token');
  if (!token) return <Navigate replace to="/app/household" />;

  const respond = async (accept: boolean) => {
    setWorking(true);
    setError(null);
    try {
      const householdId = await respondToHouseholdInvitation(token, accept);
      if (accept && householdId)
        window.localStorage.setItem('buddy-budget-active-household', householdId);
      queryClient.clear();
      void navigate('/app/household', { replace: true });
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : 'The invitation could not be processed.',
      );
      setWorking(false);
    }
  };
  return (
    <main className="invitation-page">
      <section className="settings-card">
        <p className="eyebrow">Household invitation</p>
        <h1>Join a shared budget?</h1>
        <p>
          Accept only if you recognise the person who sent this private link. Your role and access
          are controlled by the household owner.
        </p>
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-form__actions">
          <Button variant="secondary" disabled={working} onClick={() => void respond(false)}>
            Decline
          </Button>
          <Button loading={working} onClick={() => void respond(true)}>
            Accept invitation
          </Button>
        </div>
      </section>
    </main>
  );
};
