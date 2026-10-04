import { describe, expect, it } from 'vitest';
import { inspectBackupText } from './backupRestore';

const backup = {
  schema_version: 10,
  exported_at: '2026-10-02T00:00:00.000Z',
  range: { from_month: '2026-01-01', to_month: '2026-09-01' },
  profile: { user_id: 'hostile-owner', currency_code: 'ZAR' },
  preferences: { user_id: 'hostile-owner' },
  categories: [{ id: '11111111-1111-4111-8111-111111111111', user_id: 'hostile-owner' }],
  financial_accounts: [],
  transaction_import_batches: [],
  transaction_categorisation_rules: [],
  categorisation_suggestion_dismissals: [],
  payment_schedules: [],
  payment_schedule_occurrences: [],
  financial_goals: [],
  goal_contributions: [],
  goal_month_recommendations: [],
  budget_month_lifecycle: [],
  month_close_summaries: [],
  month_adjustments: [],
  month_lifecycle_events: [],
  templates: [],
  budget_months: [],
};

describe('inspectBackupText', () => {
  it('strips ownership fields and reports owner-neutral counts', () => {
    const result = inspectBackupText(JSON.stringify({ ...backup, unexpected_provider_data: true }));
    expect(result.totalRecords).toBe(1);
    expect(result.incompatibleFields).toContain('user_id');
    expect(result.payload.profile).not.toHaveProperty('user_id');
    expect(result.payload).not.toHaveProperty('unexpected_provider_data');
    expect(result.incompatibleFields).toContain('unexpected_provider_data');
  });

  it('migrates version 9 without notification logs', () => {
    const result = inspectBackupText(
      JSON.stringify({ ...backup, schema_version: 9, notification_deliveries: [{ secret: true }] }),
    );
    expect(result.schemaVersion).toBe(10);
    expect(result.payload).not.toHaveProperty('notification_deliveries');
    expect(result.warnings[0]).toMatch(/upgraded locally/);
  });

  it('rejects corrupt, future, and structurally incomplete backups', () => {
    expect(() => inspectBackupText('{')).toThrow(/valid JSON/);
    expect(() => inspectBackupText(JSON.stringify({ ...backup, schema_version: 99 }))).toThrow(
      /newer version/,
    );
    expect(() => inspectBackupText(JSON.stringify({ ...backup, categories: null }))).toThrow(
      /categories/,
    );
  });
});
