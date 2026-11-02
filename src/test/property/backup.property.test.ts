import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_BACKUP_VERSION,
  inspectBackupText,
  MAX_BACKUP_DEPTH,
  MAX_BACKUP_NODES,
} from '../../features/settings/backupRestore';

const seed = 13_030_001;
const collectionKeys = [
  'categories',
  'financial_accounts',
  'transaction_import_batches',
  'transaction_categorisation_rules',
  'categorisation_suggestion_dismissals',
  'payment_schedules',
  'payment_schedule_occurrences',
  'financial_goals',
  'goal_contributions',
  'goal_month_recommendations',
  'budget_month_lifecycle',
  'month_close_summaries',
  'month_adjustments',
  'month_lifecycle_events',
  'templates',
  'budget_months',
] as const;

const createBackup = () => ({
  schema_version: CURRENT_BACKUP_VERSION,
  exported_at: '2026-10-31T00:00:00.000Z',
  range: { from_month: null, to_month: null },
  profile: {},
  preferences: {},
  ...Object.fromEntries(collectionKeys.map((key) => [key, []])),
});

describe('backup validation properties', () => {
  it('removes forbidden ownership and credential keys at arbitrary bounded nesting', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('user_id', 'household_id', 'access_token', 'smtp_password'),
        fc.oneof(fc.string({ maxLength: 30 }), fc.integer(), fc.boolean()),
        (forbiddenKey, value) => {
          const backup = createBackup();
          backup.profile = { safe: 'kept', nested: { [forbiddenKey]: value } };
          const result = inspectBackupText(JSON.stringify(backup));
          expect(result.payload.profile).toEqual({ safe: 'kept', nested: {} });
          expect(result.incompatibleFields).toContain(forbiddenKey);
        },
      ),
      { seed, numRuns: 100 },
    );
  });

  it('rejects every unsupported schema version before producing a payload', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 8 }),
          fc.integer({ min: CURRENT_BACKUP_VERSION + 1, max: 1000 }),
        ),
        (schemaVersion) => {
          expect(() =>
            inspectBackupText(JSON.stringify({ ...createBackup(), schema_version: schemaVersion })),
          ).toThrow();
        },
      ),
      { seed: seed + 1, numRuns: 100 },
    );
  });

  it('rejects structures beyond the documented nesting bound', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_BACKUP_DEPTH + 1, max: MAX_BACKUP_DEPTH + 20 }),
        (depth) => {
          let nested: Record<string, unknown> = {};
          for (let index = 0; index < depth; index += 1) nested = { child: nested };
          expect(() =>
            inspectBackupText(JSON.stringify({ ...createBackup(), profile: nested })),
          ).toThrow(/nesting depth/);
        },
      ),
      { seed: seed + 2, numRuns: 30 },
    );
  });

  it('rejects structures beyond the documented node bound', () => {
    const nodes = Array.from({ length: MAX_BACKUP_NODES }, () => ({}));
    expect(() =>
      inspectBackupText(JSON.stringify({ ...createBackup(), profile: { nodes } })),
    ).toThrow(/structural size/);
  });
});
