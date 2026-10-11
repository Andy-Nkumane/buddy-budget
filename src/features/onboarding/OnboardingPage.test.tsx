import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { setupFirstBudget } from '../../data/repositories/budgetRepository';
import { currentMonthStart } from '../../shared/formatting/money';
import { createDemoState, DEMO_STARTER_PLAN_KEY, saveApprovedStarterPlan } from '../demo/demoModel';
import { OnboardingPage } from './OnboardingPage';
import { retrieveOnboardingDraft } from './onboardingState';

let uuidSequence = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => {
      uuidSequence += 1;
      return `40000000-0000-4000-8000-${uuidSequence.toString().padStart(12, '0')}`;
    },
    subtle: {
      digest: (_algorithm: string, data: ArrayBuffer) => {
        const source = new Uint8Array(data);
        return Promise.resolve(
          Uint8Array.from({ length: 32 }, (_, index) => source[index % source.length] ?? index)
            .buffer,
        );
      },
    },
  },
  configurable: true,
});

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/repositories/budgetRepository', () => ({ setupFirstBudget: vi.fn() }));
vi.mock('../templates/StarterTemplatePicker', () => ({
  StarterTemplatePicker: ({ onSubmit }: { onSubmit: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          id: 'minimal',
          version: 1,
          copyKey: '30000000-0000-4000-8000-000000000003',
          templateName: 'Minimal essentials',
          items: [
            {
              itemKey: 'income',
              itemType: 'income',
              name: 'Income',
              categoryName: 'Earnings',
              amount: '1000.00',
            },
          ],
        })
      }
    >
      Select minimal starter
    </button>
  ),
}));

const userId = '10000000-0000-4000-8000-000000000001';

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app/budget/:monthStart" element={<span>Budget opened</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const continueToPlan = async (pathName: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: pathName }));
  expect(screen.getByRole('heading', { name: 'Set your money and date format' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(await screen.findByText('Build your first month')).toBeVisible();
};

const reviewAndSubmit = async () => {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(
    await screen.findByRole('heading', { name: 'Ready for your first dashboard' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /create my dashboard/i }));
};

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: userId } } as ReturnType<typeof useAuth>['session'],
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(setupFirstBudget).mockResolvedValue({
      id: 'month-id',
      month_start: '2026-10-01',
    } as Awaited<ReturnType<typeof setupFirstBudget>>);
  });

  it('completes the blank path once and routes directly to the dashboard', async () => {
    renderPage();
    await continueToPlan(/build a simple plan/i);
    await reviewAndSubmit();
    expect(await screen.findByText('Budget opened')).toBeVisible();
    expect(setupFirstBudget).toHaveBeenCalledOnce();
    expect(vi.mocked(setupFirstBudget).mock.calls[0][0]).toMatchObject({
      path: 'blank',
    });
  });

  it('previews and consumes an approved transferred plan only after success', async () => {
    const demo = createDemoState();
    demo.items[2].plannedMinor = 600_000;
    saveApprovedStarterPlan(localStorage, demo.items);
    renderPage();
    await continueToPlan(/use my saved plan/i);
    expect(screen.getByDisplayValue('6000.00')).toBeVisible();
    await reviewAndSubmit();
    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledOnce());
    expect(localStorage.getItem(DEMO_STARTER_PLAN_KEY)).toBeNull();
  });

  it('uses the curated starter selection without repeating plan entry', async () => {
    renderPage();
    await continueToPlan(/use a curated starter/i);
    fireEvent.click(screen.getByRole('button', { name: /choose a starter template/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Select minimal starter' }));
    expect(screen.getByDisplayValue('Minimal essentials')).toBeVisible();
    await reviewAndSubmit();
    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledOnce());
    expect(vi.mocked(setupFirstBudget).mock.calls[0][0]).toMatchObject({
      path: 'starter',
      starter: { id: 'minimal', version: 1 },
    });
  });

  it('previews a CSV locally and submits its valid transactions with the first month', async () => {
    renderPage();
    await continueToPlan(/import a bank statement/i);
    const month = currentMonthStart().slice(0, 7);
    fireEvent.change(screen.getByLabelText('Bank statement CSV'), {
      target: {
        files: [
          new File(
            [`Date,Description,Amount\n${month}-02,Salary,1000.00\n${month}-03,Food,-25.50`],
            'statement.csv',
          ),
        ],
      },
    });
    expect(await screen.findByRole('button', { name: 'Prepare preview' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare preview' }));
    expect(await screen.findByText(/2 valid rows/i)).toBeVisible();
    await reviewAndSubmit();
    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledOnce());
    expect(vi.mocked(setupFirstBudget).mock.calls[0][0]).toMatchObject({
      path: 'csv',
      csvImport: { file_name: 'statement.csv', invalid_count: 0 },
    });
  });

  it('keeps resumable progress scoped to the authenticated account', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /build a simple plan/i }));
    fireEvent.change(screen.getByLabelText('Display name (optional)'), {
      target: { value: 'Alex' },
    });
    await waitFor(() =>
      expect(retrieveOnboardingDraft(localStorage, userId)?.displayName).toBe('Alex'),
    );
    expect(
      retrieveOnboardingDraft(localStorage, '20000000-0000-4000-8000-000000000002'),
    ).toBeNull();
  });

  it('supports back navigation without losing the selected path', async () => {
    renderPage();
    await continueToPlan(/build a simple plan/i);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: 'Set your money and date format' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByDisplayValue('My monthly plan')).toBeVisible();
  });

  it('retains recoverable progress and setup key after a failed submission', async () => {
    vi.mocked(setupFirstBudget).mockRejectedValueOnce(new Error('Temporary setup failure'));
    renderPage();
    await continueToPlan(/build a simple plan/i);
    await reviewAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary setup failure');
    const setupKey = retrieveOnboardingDraft(localStorage, userId)?.setupKey;
    fireEvent.click(screen.getByRole('button', { name: /create my dashboard/i }));
    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledTimes(2));
    expect(vi.mocked(setupFirstBudget).mock.calls[1][0].setupKey).toBe(setupKey);
  });
});
