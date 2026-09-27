import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Eye, Mail, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  previewWeeklyCheckIn,
  retrieveProfile,
  retrieveWeeklyCheckInPreferences,
  searchNotificationDeliveries,
  sendTestWeeklyCheckIn,
  updateWeeklyCheckInPreferences,
} from '../../data/repositories/budgetRepository';
import {
  includePreferenceOption,
  timezoneOptions,
} from '../../shared/localization/preferenceOptions';
import type { WeeklyCheckInSummary } from '../../shared/checkins/checkin';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type FormState = {
  optedIn: boolean;
  weekday: number;
  deliveryTime: string;
  timezone: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  emailDetailEnabled: boolean;
  paused: boolean;
};

export const WeeklyCheckInPage = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const preferences = useQuery({
    queryKey: queryKeys.weeklyCheckInPreferences(userId),
    queryFn: retrieveWeeklyCheckInPreferences,
  });
  const deliveries = useQuery({
    queryKey: queryKeys.notificationDeliveries(userId),
    queryFn: searchNotificationDeliveries,
  });
  const [formOverrides, setFormOverrides] = useState<Partial<FormState>>({});
  const [preview, setPreview] = useState<WeeklyCheckInSummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setStatus(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The request could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  if (profile.isLoading || preferences.isLoading) return <LoadingState />;
  if (profile.error || preferences.error || !profile.data)
    return <ErrorState message="Check-in settings are unavailable." />;
  const saved = preferences.data;
  const form: FormState = {
    optedIn: saved?.opted_in ?? false,
    weekday: saved?.weekday ?? 1,
    deliveryTime: saved?.delivery_time?.slice(0, 5) ?? '18:00',
    timezone: saved?.timezone ?? profile.data.timezone,
    inAppEnabled: saved?.in_app_enabled ?? true,
    emailEnabled: saved?.email_enabled ?? false,
    emailDetailEnabled: saved?.email_detail_enabled ?? false,
    paused: saved?.paused ?? false,
    ...formOverrides,
  };
  const setForm = (next: FormState) => setFormOverrides(next);
  const selectedTimezones = includePreferenceOption(timezoneOptions, form.timezone);

  return (
    <section className="page checkin-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Stay on course</p>
          <h1>Weekly budget check-in</h1>
          <p>Choose one useful weekly reminder. Nothing is sent until you opt in.</p>
        </div>
      </header>
      <div className="checkin-layout">
        <form
          className="settings-card checkin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run('save', async () => {
              if (form.optedIn && !form.inAppEnabled && !form.emailEnabled)
                throw new Error('Choose at least one delivery channel.');
              await updateWeeklyCheckInPreferences(form);
              await queryClient.invalidateQueries({
                queryKey: queryKeys.weeklyCheckInPreferences(userId),
              });
              setStatus('Check-in preferences saved.');
            });
          }}
        >
          <fieldset className="checkin-fieldset">
            <legend>Delivery preferences</legend>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.optedIn}
                onChange={(event) => setForm({ ...form, optedIn: event.target.checked })}
              />
              <span>
                <strong>Enable weekly check-ins</strong>
                <small>Explicit opt-in is required.</small>
              </span>
            </label>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Weekday</span>
                <select
                  className="input"
                  value={form.weekday}
                  onChange={(event) => setForm({ ...form, weekday: Number(event.target.value) })}
                >
                  {weekdays.map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Local delivery time</span>
                <input
                  className="input"
                  type="time"
                  value={form.deliveryTime}
                  onChange={(event) => setForm({ ...form, deliveryTime: event.target.value })}
                />
              </label>
              <label className="field checkin-timezone">
                <span className="field__label">Timezone</span>
                <select
                  className="input"
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                >
                  {selectedTimezones.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="checkin-fieldset">
            <legend>Channels</legend>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.inAppEnabled}
                onChange={(event) => setForm({ ...form, inAppEnabled: event.target.checked })}
              />
              <Smartphone aria-hidden="true" size={20} />
              <span>
                <strong>In app</strong>
                <small>Show the check-in after you sign in.</small>
              </span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.emailEnabled}
                onChange={(event) =>
                  setForm({
                    ...form,
                    emailEnabled: event.target.checked,
                    emailDetailEnabled: event.target.checked ? form.emailDetailEnabled : false,
                  })
                }
              />
              <Mail aria-hidden="true" size={20} />
              <span>
                <strong>Email</strong>
                <small>Send through the configured Mailjet account.</small>
              </span>
            </label>
            <label className="check-row check-row--nested">
              <input
                type="checkbox"
                disabled={!form.emailEnabled}
                checked={form.emailDetailEnabled}
                onChange={(event) => setForm({ ...form, emailDetailEnabled: event.target.checked })}
              />
              <span>
                <strong>Include financial values</strong>
                <small>Off by default. Private amounts otherwise stay inside Buddy Budget.</small>
              </span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.paused}
                onChange={(event) => setForm({ ...form, paused: event.target.checked })}
              />
              <span>
                <strong>Pause delivery</strong>
                <small>Keep these choices without sending reminders.</small>
              </span>
            </label>
          </fieldset>
          {error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {error}
            </div>
          )}
          {status && (
            <div className="inline-alert" role="status">
              {status}
            </div>
          )}
          <div className="button-row">
            <Button type="submit" loading={busy === 'save'}>
              Save preferences
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<Eye size={18} />}
              loading={busy === 'preview'}
              onClick={() =>
                void run('preview', async () => setPreview(await previewWeeklyCheckIn()))
              }
            >
              Preview
            </Button>
          </div>
        </form>
        <aside className="settings-card checkin-preview" aria-live="polite">
          <BellRing aria-hidden="true" size={28} />
          <h2>Preview</h2>
          {preview ? (
            <>
              <h3>{preview.recommendation.title}</h3>
              <p>{preview.recommendation.body}</p>
              <dl className="checkin-stats">
                <div>
                  <dt>Exceeded</dt>
                  <dd>{preview.exceededItems.length}</dd>
                </div>
                <div>
                  <dt>Approaching</dt>
                  <dd>{preview.approachingItems.length}</dd>
                </div>
                <div>
                  <dt>Uncategorised</dt>
                  <dd>{preview.uncategorisedCount}</dd>
                </div>
                <div>
                  <dt>Due soon</dt>
                  <dd>{preview.upcomingObligations.length}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>Create a private preview before enabling delivery.</p>
          )}
          <div className="stacked-actions">
            <Button
              variant="secondary"
              disabled={
                !preferences.data?.opted_in ||
                !preferences.data.in_app_enabled ||
                preferences.data.paused
              }
              loading={busy === 'in_app'}
              onClick={() =>
                void run('in_app', async () => {
                  await sendTestWeeklyCheckIn('in_app');
                  setStatus('Test check-in delivered in app.');
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.notificationDeliveries(userId),
                  });
                })
              }
            >
              Send in-app test
            </Button>
            <Button
              variant="secondary"
              disabled={
                !preferences.data?.opted_in ||
                !preferences.data.email_enabled ||
                preferences.data.paused
              }
              loading={busy === 'email'}
              onClick={() =>
                void run('email', async () => {
                  await sendTestWeeklyCheckIn('email');
                  setStatus('Test email accepted for delivery.');
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.notificationDeliveries(userId),
                  });
                })
              }
            >
              Send email test
            </Button>
          </div>
        </aside>
      </div>
      <section className="settings-card">
        <h2>Recent delivery activity</h2>
        {deliveries.data?.length ? (
          <ul className="delivery-list">
            {deliveries.data.map((delivery) => (
              <li key={delivery.id}>
                <span>
                  {delivery.channel === 'in_app' ? 'In app' : 'Email'} ·{' '}
                  {delivery.delivery_kind === 'test' ? 'Test' : 'Weekly'}
                </span>
                <strong>{delivery.status.replace('_', ' ')}</strong>
                <time dateTime={delivery.scheduled_for}>
                  {new Date(delivery.scheduled_for).toLocaleString()}
                </time>
                {delivery.error_summary && <small>{delivery.error_summary}</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p>No deliveries yet.</p>
        )}
      </section>
    </section>
  );
};
