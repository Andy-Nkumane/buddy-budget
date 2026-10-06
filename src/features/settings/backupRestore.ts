export const CURRENT_BACKUP_VERSION = 10;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

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

const forbiddenKeys = new Set([
  'user_id',
  'owner_id',
  'owner_user_id',
  'data_owner_user_id',
  'household_id',
  'active_household_id',
  'email',
  'password',
  'access_token',
  'refresh_token',
  'service_role_key',
  'smtp_password',
  'mailjet_api_key',
  'mailjet_secret_key',
  'provider_message_id',
  'notification_deliveries',
  'planned_versus_actual',
]);

const supportedTopLevelKeys = new Set([
  'schema_version',
  'exported_at',
  'range',
  'profile',
  'preferences',
  'weekly_checkin_preferences',
  ...collectionKeys,
]);

export type BackupRestoreMode = 'merge' | 'replace';

export interface BackupInspection {
  payload: Record<string, unknown>;
  schemaVersion: number;
  originalSchemaVersion: number;
  counts: Record<string, number>;
  totalRecords: number;
  fromMonth: string | null;
  toMonth: string | null;
  currencies: string[];
  warnings: string[];
  incompatibleFields: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitize = (value: unknown, path: string, incompatibleFields: string[]): unknown => {
  if (Array.isArray(value))
    return value.map((entry, index) => sanitize(entry, `${path}[${index}]`, incompatibleFields));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (forbiddenKeys.has(key.toLowerCase())) {
        incompatibleFields.push(path ? `${path}.${key}` : key);
        return [];
      }
      return [[key, sanitize(entry, path ? `${path}.${key}` : key, incompatibleFields)]];
    }),
  );
};

const migrateBackup = (input: Record<string, unknown>, warnings: string[]) => {
  const version = Number(input.schema_version);
  if (version === 9) {
    warnings.push(
      'Schema version 9 was upgraded locally. Notification delivery logs are intentionally excluded.',
    );
    const migrated = { ...input };
    delete migrated.notification_deliveries;
    return {
      ...migrated,
      schema_version: CURRENT_BACKUP_VERSION,
      categorisation_suggestion_dismissals: [],
    };
  }
  return input;
};

const collectCurrencies = (value: unknown, currencies: Set<string>): void => {
  if (Array.isArray(value)) return value.forEach((entry) => collectCurrencies(entry, currencies));
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, entry]) => {
    if (key === 'currency_code' && typeof entry === 'string' && /^[A-Z]{3}$/.test(entry))
      currencies.add(entry);
    else collectCurrencies(entry, currencies);
  });
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validatePortableValues = (value: unknown, path = 'backup'): void => {
  if (Array.isArray(value))
    return value.forEach((entry, index) => validatePortableValues(entry, `${path}[${index}]`));
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, entry]) => {
    const entryPath = `${path}.${key}`;
    if ((key === 'id' || key.endsWith('_id') || key === 'idempotency_key') && entry !== null) {
      if (typeof entry !== 'string' || !uuidPattern.test(entry))
        throw new Error(`${entryPath} must be a valid identifier.`);
    }
    if (
      key.endsWith('_minor') &&
      entry !== null &&
      (!Number.isSafeInteger(entry) || Math.abs(entry as number) > 99_999_999_999_999)
    )
      throw new Error(`${entryPath} must be an exact integer minor-unit amount.`);
    if (key === 'item_type' && entry !== 'income' && entry !== 'expense')
      throw new Error(`${entryPath} must be income or expense.`);
    validatePortableValues(entry, entryPath);
  });
};

export const inspectBackupText = (text: string): BackupInspection => {
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error('The backup is larger than the 10 MB restore limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isObject(parsed)) throw new Error('The backup root must be a JSON object.');
  const originalSchemaVersion = Number(parsed.schema_version);
  if (!Number.isInteger(originalSchemaVersion))
    throw new Error('The backup has no valid schema version.');
  if (originalSchemaVersion < 9)
    throw new Error(`Backup version ${originalSchemaVersion} is too old to restore safely.`);
  if (originalSchemaVersion > CURRENT_BACKUP_VERSION)
    throw new Error(
      `Backup version ${originalSchemaVersion} requires a newer version of Buddy Budget.`,
    );
  const warnings: string[] = [];
  const incompatibleFields: string[] = [];
  const migrated = migrateBackup(parsed, warnings);
  const supported = Object.fromEntries(
    Object.entries(migrated).filter(([key]) => {
      if (supportedTopLevelKeys.has(key)) return true;
      incompatibleFields.push(key);
      return false;
    }),
  );
  const payload = sanitize(supported, '', incompatibleFields) as Record<string, unknown>;
  validatePortableValues(payload);
  for (const key of collectionKeys) {
    if (!Array.isArray(payload[key])) throw new Error(`The backup field “${key}” must be a list.`);
  }
  if (!isObject(payload.profile) || !isObject(payload.preferences))
    throw new Error('The backup must contain profile and preference records.');
  const counts: Record<string, number> = Object.fromEntries(
    collectionKeys.map((key) => {
      const entries = payload[key] as unknown[];
      const nested = entries.reduce<number>((total, entry) => {
        if (!isObject(entry))
          throw new Error(`The backup field “${key}” contains an invalid record.`);
        return (
          total +
          (Array.isArray(entry.template_items) ? entry.template_items.length : 0) +
          (Array.isArray(entry.budget_month_items) ? entry.budget_month_items.length : 0) +
          (Array.isArray(entry.budget_transactions) ? entry.budget_transactions.length : 0)
        );
      }, 0);
      return [key, entries.length + nested];
    }),
  );
  const totalRecords = Object.values(counts).reduce((total, count) => total + count, 0);
  if (totalRecords > 10_000) throw new Error('The backup exceeds the 10,000-record restore limit.');
  const currencies = new Set<string>();
  collectCurrencies(payload, currencies);
  if (incompatibleFields.length)
    warnings.push('Ownership, authentication, secret, or operational fields will not be imported.');
  const range = isObject(payload.range) ? payload.range : {};
  return {
    payload,
    schemaVersion: CURRENT_BACKUP_VERSION,
    originalSchemaVersion,
    counts,
    totalRecords,
    fromMonth: typeof range.from_month === 'string' ? range.from_month : null,
    toMonth: typeof range.to_month === 'string' ? range.to_month : null,
    currencies: [...currencies].sort(),
    warnings,
    incompatibleFields: [
      ...new Set(incompatibleFields.map((field) => field.split('.').at(-1) ?? field)),
    ],
  };
};
