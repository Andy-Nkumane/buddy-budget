import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const PasswordField = ({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? props.name;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const description = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const actionLabel = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`;

  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="password-input">
        <input
          id={fieldId}
          className={`input password-input__field ${error ? 'input--error' : ''}`}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={description}
          autoCorrect="off"
          spellCheck={false}
          {...props}
        />
        <button
          className="password-input__toggle"
          type="button"
          aria-controls={fieldId}
          aria-label={actionLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
