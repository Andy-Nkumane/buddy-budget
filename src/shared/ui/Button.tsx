import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = ({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) => (
  <button
    className={`button button--${variant} ${className}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <span className="spinner" aria-hidden="true" /> : icon}
    <span>{children}</span>
  </button>
);
