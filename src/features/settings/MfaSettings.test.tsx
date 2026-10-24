import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTotpEnrollment,
  deleteTotpFactor,
  retrieveMfaAssurance,
  retrieveTotpFactors,
  verifyTotpFactor,
} from '../auth/mfa';
import { MfaSettings } from './MfaSettings';

vi.mock('../auth/mfa', () => ({
  createTotpEnrollment: vi.fn(),
  deleteTotpFactor: vi.fn(),
  retrieveMfaAssurance: vi.fn(),
  retrieveTotpFactors: vi.fn(),
  verifyTotpFactor: vi.fn(),
}));

describe('AUTH-002 MfaSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });
    vi.mocked(retrieveTotpFactors).mockResolvedValue([]);
    vi.mocked(createTotpEnrollment).mockResolvedValue({
      factorId: 'new-factor',
      qrCode: 'data:image/svg+xml,test-qr',
      secret: 'SYNTHETICSETUPKEY',
    });
    vi.mocked(verifyTotpFactor).mockResolvedValue(undefined);
    vi.mocked(deleteTotpFactor).mockResolvedValue(undefined);
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
    expect(await screen.findByAltText('Authenticator setup QR code')).toBeVisible();
    expect(screen.getByText('SYNTHETICSETUPKEY')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Six-digit verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/app added/i));
    expect(verifyTotpFactor).toHaveBeenCalledWith('new-factor', '123456');
    expect(screen.queryByText('SYNTHETICSETUPKEY')).not.toBeInTheDocument();
  });

  it('removes an abandoned unverified factor when setup is cancelled', async () => {
    render(<MfaSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel setup' }));

    await waitFor(() => expect(deleteTotpFactor).toHaveBeenCalledWith('new-factor'));
    expect(screen.queryByAltText('Authenticator setup QR code')).not.toBeInTheDocument();
  });

  it('shows an incorrect verification code beside the code field', async () => {
    vi.mocked(verifyTotpFactor).mockRejectedValue(
      new Error('That verification code could not be confirmed. Check it and try again.'),
    );
    render(<MfaSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator' }));
    const codeField = await screen.findByLabelText('Six-digit verification code');
    fireEvent.change(codeField, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be confirmed/i);
    expect(codeField).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Verify and enable' })).toBeVisible();
  });
});
