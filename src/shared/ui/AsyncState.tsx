import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const LoadingState = ({ label = 'Loading Buddy Budget…' }: { label?: string }) => (
  <div className="state-panel" role="status">
    <span className="spinner spinner--large" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="state-panel state-panel--error" role="alert">
    <AlertCircle aria-hidden="true" />
    <h2>We couldn’t load this</h2>
    <p>{message}</p>
    {retry && (
      <Button icon={<RefreshCw aria-hidden="true" size={18} />} onClick={retry}>
        Try again
      </Button>
    )}
  </div>
);
