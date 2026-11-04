import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTotpEnrollment,
  deleteTotpFactor,
  generateRecoveryCodes,
  regenerateRecoveryCodes,
  refreshMfaSessionAssurance,
  retrieveMfaAssurance,
  retrieveRecoveryCodesStatus,
  retrieveTotpFactors,
  verifyTotpFactor,
} from '../auth/mfa';
import { reauthenticateWithPassword } from '../../data/repositories/budgetRepository';
import { MfaSettings } from './MfaSettings';

const navigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

vi.mock('../auth/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/mfa')>()),
  createTotpEnrollment: vi.fn(),
  deleteTotpFactor: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  refreshMfaSessionAssurance: vi.fn(),
  retrieveMfaAssurance: vi.fn(),
  retrieveRecoveryCodesStatus: vi.fn(),
  retrieveTotpFactors: vi.fn(),
  verifyTotpFactor: vi.fn(),
}));
vi.mock('../../data/repositories/budgetRepository', () => ({
  reauthenticateWithPassword: vi.fn(),
}));

const personalPhone = {
  id: 'personal-factor',
  factor_type: 'totp' as const,
  status: 'verified' as const,
  friendly_name: 'Personal phone',
  created_at: '2026-10-24T00:00:00.000Z',
  updated_at: '2026-10-24T00:00:00.000Z',
};

const workAuthenticator = {
  ...personalPhone,
  id: 'work-factor',
  friendly_name: 'Work authenticator',
  created_at: '2026-10-25T00:00:00.000Z',
  updated_at: '2026-10-25T00:00:00.000Z',
};

describe('AUTH-002 MfaSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });
    vi.mocked(retrieveTotpFactors).mockResolvedValue([]);
    vi.mocked(retrieveRecoveryCodesStatus).mockResolvedValue(null);
    vi.mocked(generateRecoveryCodes).mockResolvedValue({
      id: 'recovery-factor',
      total: 2,
      remaining: 2,
      codes: ['SYNTHETIC-ONE', 'SYNTHETIC-TWO'],
    });
    vi.mocked(regenerateRecoveryCodes).mockResolvedValue({
      id: 'recovery-factor',
      total: 2,
      remaining: 2,
      codes: ['REPLACED-ONE', 'REPLACED-TWO'],
    });
    vi.mocked(createTotpEnrollment).mockResolvedValue({
      factorId: 'new-factor',
      qrCode: 'data:image/svg+xml,test-qr',
      secret: 'SYNTHETICSETUPKEY',
    });
    vi.mocked(verifyTotpFactor).mockResolvedValue(undefined);
    vi.mocked(deleteTotpFactor).mockResolvedValue(undefined);
    vi.mocked(refreshMfaSessionAssurance).mockResolvedValue({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });
    vi.mocked(reauthenticateWithPassword).mockResolvedValue(undefined);
  });

  it('enrolls and verifies an authenticator without persisting its secret', async () => {
    vi.mocked(retrieveTotpFactors)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'new-factor',
          factor_type: 'totp',
          status: 'verified',
          friendly_name: 'Authenticator app',
          created_at: '2026-10-24T00:00:00.000Z',
          updated_at: '2026-10-24T00:00:00.000Z',
        },
      ]);
    vi.mocked(retrieveMfaAssurance)
      .mockResolvedValueOnce({ currentLevel: 'aal1', nextLevel: 'aal1' })
      .mockResolvedValueOnce({ currentLevel: 'aal2', nextLevel: 'aal2' });
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Authenticator name' }), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }));
    expect(await screen.findByAltText('Authenticator setup QR code')).toBeVisible();
    expect(screen.getByText('SYNTHETICSETUPKEY')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Six-digit verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(
      await screen.findByText('Authenticator app added. Save your recovery codes now.'),
    ).toBeVisible();
    expect(createTotpEnrollment).toHaveBeenCalledWith('Personal phone');
    expect(verifyTotpFactor).toHaveBeenCalledWith('new-factor', '123456');
    expect(screen.queryByText('SYNTHETICSETUPKEY')).not.toBeInTheDocument();
    expect(screen.getByText('SYNTHETIC-ONE')).toBeVisible();
    expect(generateRecoveryCodes).toHaveBeenCalledOnce();
  });

  it('removes an abandoned unverified factor when setup is cancelled', async () => {
    render(<MfaSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Authenticator name' }), {
      target: { value: 'Work password manager' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel setup' }));

    await waitFor(() => expect(deleteTotpFactor).toHaveBeenCalledWith('new-factor'));
    expect(screen.queryByAltText('Authenticator setup QR code')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    expect(screen.getByRole('textbox', { name: 'Authenticator name' })).toHaveValue('');
  });

  it('shows an incorrect verification code beside the code field', async () => {
    vi.mocked(verifyTotpFactor).mockRejectedValue(
      new Error('That verification code could not be confirmed. Check it and try again.'),
    );
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Authenticator name' }), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }));
    const codeField = await screen.findByLabelText('Six-digit verification code');
    fireEvent.change(codeField, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be confirmed/i);
    expect(codeField).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Verify and enable' })).toBeVisible();
  });

  it('shows empty and duplicate name errors beside the name field', async () => {
    vi.mocked(createTotpEnrollment).mockRejectedValueOnce(
      new Error('That name is already in use. Choose a different authenticator name.'),
    );
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }));
    const nameField = screen.getByRole('textbox', { name: 'Authenticator name' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i);
    expect(nameField).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(nameField, { target: { value: 'Personal phone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue setup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already in use/i);
    expect(nameField).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not begin removal from an aal1 session', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    render(<MfaSettings />);

    const removeButton = await screen.findByRole('button', { name: 'Remove Personal phone' });
    expect(removeButton).toBeDisabled();
    expect(screen.getByText(/verify with an authenticator before removing/i)).toBeVisible();
  });

  it('requires exact confirmation, password, and a different remaining factor', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone, workAuthenticator]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    vi.mocked(refreshMfaSessionAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Personal phone' }));
    expect(await screen.findByRole('heading', { name: 'Remove Personal phone?' })).toBeVisible();
    expect(screen.getByLabelText('Six-digit code from Work authenticator')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.change(screen.getByLabelText('Six-digit code from Work authenticator'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('Type Personal phone to confirm'), {
      target: { value: 'personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of Personal phone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/type .* exactly/i);
    expect(deleteTotpFactor).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Type Personal phone to confirm'), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of Personal phone' }));

    await waitFor(() => expect(deleteTotpFactor).toHaveBeenCalledWith('personal-factor'));
    expect(reauthenticateWithPassword).toHaveBeenCalledWith('correct horse battery staple');
    expect(verifyTotpFactor).toHaveBeenCalledWith('work-factor', '123456');
    expect(refreshMfaSessionAssurance).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(/security level has been refreshed/i);
  });

  it('warns before removing the last factor and verifies with that factor', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Personal phone' }));
    expect(await screen.findByText(/last authenticator/i)).toBeVisible();
    expect(screen.getByLabelText('Six-digit code from Personal phone')).toBeVisible();
  });

  it('does not report success when another tab removes the selected factor', async () => {
    vi.mocked(retrieveTotpFactors)
      .mockResolvedValueOnce([personalPhone])
      .mockResolvedValueOnce([personalPhone])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Personal phone' }));
    fireEvent.change(await screen.findByLabelText('Current password'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.change(screen.getByLabelText('Six-digit code from Personal phone'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('Type Personal phone to confirm'), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of Personal phone' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/settings changed/i);
    expect(deleteTotpFactor).not.toHaveBeenCalled();
    expect(screen.queryByText(/app removed/i)).not.toBeInTheDocument();
  });

  it('keeps password failures generic and does not remove the factor', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    vi.mocked(reauthenticateWithPassword).mockRejectedValueOnce(
      new Error('Provider password diagnostic'),
    );
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Personal phone' }));
    fireEvent.change(await screen.findByLabelText('Current password'), {
      target: { value: 'wrong password' },
    });
    fireEvent.change(screen.getByLabelText('Six-digit code from Personal phone'), {
      target: { value: '000000' },
    });
    fireEvent.change(screen.getByLabelText('Type Personal phone to confirm'), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of Personal phone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/password could not be confirmed/i);
    expect(screen.queryByText(/provider password diagnostic/i)).not.toBeInTheDocument();
  });

  it('moves an aal1 session to the MFA challenge after an incorrect removal code', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone]);
    vi.mocked(retrieveMfaAssurance)
      .mockResolvedValueOnce({ currentLevel: 'aal2', nextLevel: 'aal2' })
      .mockResolvedValueOnce({ currentLevel: 'aal2', nextLevel: 'aal2' })
      .mockResolvedValueOnce({ currentLevel: 'aal2', nextLevel: 'aal2' });
    vi.mocked(verifyTotpFactor).mockRejectedValueOnce(
      new Error('That verification code could not be confirmed. Check it and try again.'),
    );
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Personal phone' }));
    fireEvent.change(await screen.findByLabelText('Current password'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.change(screen.getByLabelText('Six-digit code from Personal phone'), {
      target: { value: '000000' },
    });
    fireEvent.change(screen.getByLabelText('Type Personal phone to confirm'), {
      target: { value: 'Personal phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of Personal phone' }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/auth/mfa', {
        replace: true,
        state: {
          from: '/app/settings',
          reason: 'reauthentication-code-rejected',
        },
      }),
    );
    expect(deleteTotpFactor).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: 'Remove Personal phone?' }),
    ).not.toBeInTheDocument();
  });

  it('requires password and a selected authenticator before replacing recovery codes', async () => {
    vi.mocked(retrieveTotpFactors).mockResolvedValue([personalPhone, workAuthenticator]);
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    vi.mocked(retrieveRecoveryCodesStatus).mockResolvedValue({
      id: 'recovery-factor',
      total: 8,
      remaining: 3,
    });
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Replace recovery codes' }));
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.change(screen.getByLabelText('Authenticator app'), {
      target: { value: 'work-factor' },
    });
    fireEvent.change(screen.getByLabelText('Current six-digit authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replace recovery codes' }));

    expect(await screen.findByText('REPLACED-ONE')).toBeVisible();
    expect(reauthenticateWithPassword).toHaveBeenCalledWith('correct horse battery staple');
    expect(verifyTotpFactor).toHaveBeenCalledWith('work-factor', '123456');
    expect(regenerateRecoveryCodes).toHaveBeenCalledOnce();
  });
});
