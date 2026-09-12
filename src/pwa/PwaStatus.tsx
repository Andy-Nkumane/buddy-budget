import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../shared/ui/Button';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const PwaStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(
    sessionStorage.getItem('buddybudget-install-dismissed') === 'true',
  );
  const [editing, setEditing] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleEditState = (event: Event) =>
      setEditing((event as CustomEvent<{ editing: boolean }>).detail.editing);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('buddybudget-edit-state', handleEditState);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('buddybudget-edit-state', handleEditState);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  return (
    <>
      {!online && (
        <div className="status-banner status-banner--offline" role="status">
          <WifiOff aria-hidden="true" size={18} />
          <span>You’re offline. Viewing is limited and budget changes are disabled.</span>
        </div>
      )}
      {needRefresh && (
        <div className="status-banner" role="status">
          <RefreshCw aria-hidden="true" size={18} />
          <span>
            {editing
              ? 'An update is ready. Finish saving your edit first.'
              : 'A fresh version is ready.'}
          </span>
          <Button
            disabled={editing}
            onClick={() => void updateServiceWorker(true)}
            variant="secondary"
          >
            Update
          </Button>
          <button className="text-button" onClick={() => setNeedRefresh(false)} type="button">
            Later
          </button>
        </div>
      )}
      {installPrompt && !installDismissed && !isStandalone() && (
        <div className="install-card" role="region" aria-label="Install BuddyBudget">
          <Download aria-hidden="true" />
          <div>
            <strong>Keep your budget close</strong>
            <span>Install BuddyBudget for quick access from your home screen.</span>
          </div>
          <Button onClick={() => void install()} variant="secondary">
            Install
          </Button>
          <button
            className="text-button"
            onClick={() => {
              sessionStorage.setItem('buddybudget-install-dismissed', 'true');
              setInstallDismissed(true);
            }}
            type="button"
          >
            Not now
          </button>
        </div>
      )}
    </>
  );
};
