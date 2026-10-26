import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('reveals and masks the password without changing its value or metadata', () => {
    render(
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        defaultValue="a long private passphrase"
        hint="Use 15 or more characters."
      />,
    );

    const input = screen.getByLabelText('New password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('spellcheck', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('a long private passphrase');
    expect(screen.getByRole('button', { name: 'Hide new password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('associates guidance and validation errors with the input', () => {
    render(
      <PasswordField
        label="Password"
        name="password"
        hint="Use a passphrase."
        error="Use at least 15 characters."
      />,
    );

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAccessibleDescription('Use at least 15 characters. Use a passphrase.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 15 characters.');
  });
});
