import { Info } from 'lucide-react';
import { useId, useState } from 'react';

export const InfoHelp = ({ label, children }: { label: string; children: string }) => {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();

  return (
    <span
      className="info-help"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();
        }
      }}
    >
      <button
        type="button"
        className="info-help__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={descriptionId}
        onClick={() => setOpen((current) => !current)}
      >
        <Info aria-hidden="true" size={15} />
      </button>
      {open && (
        <span className="info-help__content" id={descriptionId} role="note">
          {children}
        </span>
      )}
    </span>
  );
};
