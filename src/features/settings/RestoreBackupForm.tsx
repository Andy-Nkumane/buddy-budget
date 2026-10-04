import { AlertTriangle, Download, Upload } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  reauthenticateForRestore,
  restoreBackup,
  type BackupRestoreReport,
} from '../../data/repositories/budgetRepository';
import { downloadJson } from '../../shared/utilities/download';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import {
  inspectBackupText,
  MAX_BACKUP_BYTES,
  type BackupInspection,
  type BackupRestoreMode,
} from './backupRestore';

interface RestoreBackupFormProps {
  onComplete: () => void;
}

const fingerprintPayload = async (payload: Record<string, unknown>) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const RestoreBackupForm = ({ onComplete }: RestoreBackupFormProps) => {
  const queryClient = useQueryClient();
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [mode, setMode] = useState<BackupRestoreMode>('merge');
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [report, setReport] = useState<BackupRestoreReport | null>(null);

  const inspectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setReport(null);
    setInspection(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('The backup is larger than the 10 MB restore limit.');
      return;
    }
    try {
      setInspection(inspectBackupText(await file.text()));
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'The backup could not be read.');
    }
  };

  const submit = async () => {
    if (!inspection) return;
    setError(null);
    setRestoring(true);
    try {
      if (mode === 'replace') {
        await reauthenticateForRestore(password);
        setPassword('');
      }
      const result = await restoreBackup({
        payload: inspection.payload,
        mode,
        fingerprint: await fingerprintPayload(inspection.payload),
        confirmation,
      });
      setReport(result);
      await queryClient.invalidateQueries();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : 'The backup could not be restored.',
      );
    } finally {
      setRestoring(false);
    }
  };

  if (report) {
    return (
      <section className="restore-result" aria-live="polite">
        <h3>Restore completed</h3>
        <p>The operation finished transactionally. Download the report for your records.</p>
        {report.recovery_snapshot_id && <p>Recovery snapshot: {report.recovery_snapshot_id}</p>}
        <dl className="restore-result__counts">
          <div>
            <dt>Inserted</dt>
            <dd>{Object.values(report.inserted).reduce((a, b) => a + b, 0)}</dd>
          </div>
          <div>
            <dt>Matched</dt>
            <dd>{Object.values(report.matched).reduce((a, b) => a + b, 0)}</dd>
          </div>
          <div>
            <dt>Skipped</dt>
            <dd>{Object.values(report.skipped).reduce((a, b) => a + b, 0)}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>{Object.values(report.failed).reduce((a, b) => a + b, 0)}</dd>
          </div>
        </dl>
        <div className="modal-form__actions">
          <Button
            variant="secondary"
            icon={<Download size={18} />}
            onClick={() => downloadJson(`buddy-budget-restore-${report.restore_id}.json`, report)}
          >
            Download restore report
          </Button>
          <Button onClick={onComplete}>Done</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="restore-form">
      <label className="field">
        <span className="field__label">Buddy Budget JSON backup</span>
        <input
          aria-label="Buddy Budget JSON backup"
          className="input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void inspectFile(event)}
        />
        <span className="field__hint">
          The file is parsed locally and is not sent until you confirm restoration.
        </span>
      </label>
      {error && !inspection && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {inspection && (
        <>
          <section className="restore-summary" aria-labelledby="restore-summary-title">
            <h3 id="restore-summary-title">Validated backup</h3>
            <dl>
              <div>
                <dt>Schema</dt>
                <dd>
                  Version {inspection.originalSchemaVersion}
                  {inspection.originalSchemaVersion !== inspection.schemaVersion
                    ? ` → ${inspection.schemaVersion}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>Records</dt>
                <dd>{inspection.totalRecords}</dd>
              </div>
              <div>
                <dt>Date range</dt>
                <dd>
                  {inspection.fromMonth && inspection.toMonth
                    ? `${inspection.fromMonth} to ${inspection.toMonth}`
                    : 'All available dates'}
                </dd>
              </div>
              <div>
                <dt>Currencies</dt>
                <dd>{inspection.currencies.join(', ') || 'None recorded'}</dd>
              </div>
            </dl>
            {inspection.warnings.map((warning) => (
              <p className="inline-alert" key={warning}>
                {warning}
              </p>
            ))}
            {inspection.incompatibleFields.length > 0 && (
              <p>Ignored fields: {inspection.incompatibleFields.join(', ')}</p>
            )}
          </section>
          <fieldset className="restore-mode-list">
            <legend>Restore method</legend>
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              <span>
                <strong>Merge safely</strong>
                <small>
                  Add missing records and match existing roots. Existing months—including locked
                  history—are never rewritten.
                </small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <span>
                <strong>Replace all my data</strong>
                <small>
                  Create a server recovery snapshot, then replace current domain data with this
                  backup.
                </small>
              </span>
            </label>
          </fieldset>
          {mode === 'replace' && (
            <section className="restore-danger">
              <AlertTriangle aria-hidden="true" size={22} />
              <div>
                <p>
                  <strong>This removes your current Buddy Budget domain data.</strong>
                </p>
                <FormField
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FormField
                  label="Type REPLACE MY DATA to confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            </section>
          )}
          <div className="restore-submit">
            {error && (
              <div className="inline-alert inline-alert--error" role="alert">
                {error}
              </div>
            )}
            <Button
              icon={<Upload size={18} />}
              loading={restoring}
              disabled={mode === 'replace' && (confirmation !== 'REPLACE MY DATA' || !password)}
              onClick={() => void submit()}
            >
              {mode === 'merge' ? 'Merge validated backup' : 'Replace with validated backup'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
