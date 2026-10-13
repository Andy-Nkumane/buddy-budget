import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  buildWeeklyCheckInSummary,
  type CheckInGoal,
  type CheckInItem,
  type CheckInObligation,
  type WeeklyCheckInSummary,
} from '../_shared/checkin.ts';

type Delivery = {
  id: string;
  user_id: string;
  channel: 'in_app' | 'email';
  job_key: string;
  attempt_count: number;
};

type Preferences = {
  opted_in: boolean;
  paused: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_detail_enabled: boolean;
  email_delivery_state: 'active' | 'bounced' | 'blocked';
};

type SummaryTransaction = {
  budget_month_item_id: string | null;
  category_id: string | null;
  amount_minor: number;
  transaction_type: 'income' | 'expense';
  is_refund: boolean;
  status: 'pending' | 'posted' | 'void';
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return replacements[character];
  });

const retrieveCurrentMonthStart = (timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${find('year')}-${find('month')}-01`;
};

const retrieveLocalDate = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const retrieveSummary = async (
  service: SupabaseClient,
  userId: string,
): Promise<WeeklyCheckInSummary> => {
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('timezone,currency_code,locale')
    .eq('user_id', userId)
    .single();
  if (profileError) throw new Error('profile_unavailable');
  const monthStart = retrieveCurrentMonthStart(profile.timezone);
  const { data: month, error: monthError } = await service
    .from('budget_months')
    .select('id')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();
  if (monthError) throw new Error('month_unavailable');
  if (!month) {
    return buildWeeklyCheckInSummary({
      currencyCode: profile.currency_code,
      locale: profile.locale,
      position: {
        plannedIncomeMinor: 0,
        plannedExpenseMinor: 0,
        actualIncomeMinor: 0,
        actualExpenseMinor: 0,
      },
      expenseItems: [],
      uncategorisedCount: 0,
      upcomingObligations: [],
      goals: [],
    });
  }

  const transactions: SummaryTransaction[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from('budget_transactions')
      .select('budget_month_item_id,category_id,amount_minor,transaction_type,is_refund,status')
      .eq('user_id', userId)
      .eq('budget_month_id', month.id)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error('summary_unavailable');
    const page = (data ?? []) as SummaryTransaction[];
    transactions.push(...page);
    if (page.length < 1000) break;
  }
  const [itemsResult, occurrencesResult, goalsResult] = await Promise.all([
    service
      .from('budget_month_items')
      .select('id,name_snapshot,item_type,amount,is_disabled,archived_at')
      .eq('user_id', userId)
      .eq('budget_month_id', month.id),
    service
      .from('payment_schedule_occurrences')
      .select('name_snapshot,due_date,amount_minor,item_type,status')
      .eq('user_id', userId)
      .eq('budget_month_id', month.id)
      .in('status', ['expected']),
    service
      .from('financial_goals')
      .select(
        'id,name,target_amount_minor,starting_balance_minor,status,goal_contributions(amount_minor)',
      )
      .eq('user_id', userId)
      .in('status', ['active', 'paused']),
  ]);
  if (itemsResult.error || occurrencesResult.error || goalsResult.error)
    throw new Error('summary_unavailable');

  const postedTransactions = transactions.filter((transaction) => transaction.status === 'posted');
  const signed = (transaction: (typeof transactions)[number]) =>
    transaction.is_refund ? -transaction.amount_minor : transaction.amount_minor;
  const actualIncomeMinor = postedTransactions
    .filter((transaction) => transaction.transaction_type === 'income')
    .reduce((total, transaction) => total + signed(transaction), 0);
  const actualExpenseMinor = postedTransactions
    .filter((transaction) => transaction.transaction_type === 'expense')
    .reduce((total, transaction) => total + signed(transaction), 0);
  const activeItems = (itemsResult.data ?? []).filter(
    (item) => !item.archived_at && !item.is_disabled,
  );
  const expenseItems: CheckInItem[] = activeItems
    .filter((item) => item.item_type === 'expense')
    .map((item) => ({
      name: item.name_snapshot,
      plannedMinor: Math.round(Number(item.amount) * 100),
      actualMinor: postedTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === 'expense' &&
            transaction.budget_month_item_id === item.id,
        )
        .reduce((total, transaction) => total + signed(transaction), 0),
    }));
  const today = retrieveLocalDate(profile.timezone);
  const inSevenDaysDate = new Date(`${today}T12:00:00Z`);
  inSevenDaysDate.setUTCDate(inSevenDaysDate.getUTCDate() + 7);
  const inSevenDays = inSevenDaysDate.toISOString().slice(0, 10);
  const upcomingObligations: CheckInObligation[] = (occurrencesResult.data ?? [])
    .filter((occurrence) => occurrence.due_date >= today && occurrence.due_date <= inSevenDays)
    .map((occurrence) => ({
      name: occurrence.name_snapshot,
      dueDate: occurrence.due_date,
      amountMinor: occurrence.amount_minor,
      itemType: occurrence.item_type,
    }));
  const goals: CheckInGoal[] = (goalsResult.data ?? []).map((goal) => {
    const contributed = goal.goal_contributions.reduce(
      (total: number, contribution: { amount_minor: number }) => total + contribution.amount_minor,
      0,
    );
    return {
      name: goal.name,
      remainingMinor: Math.max(
        0,
        goal.target_amount_minor - goal.starting_balance_minor - contributed,
      ),
      onTrack: goal.status === 'active' && goal.starting_balance_minor + contributed > 0,
    };
  });
  return buildWeeklyCheckInSummary({
    currencyCode: profile.currency_code,
    locale: profile.locale,
    position: {
      plannedIncomeMinor: activeItems
        .filter((item) => item.item_type === 'income')
        .reduce((total, item) => total + Math.round(Number(item.amount) * 100), 0),
      plannedExpenseMinor: expenseItems.reduce((total, item) => total + item.plannedMinor, 0),
      actualIncomeMinor,
      actualExpenseMinor,
    },
    expenseItems,
    uncategorisedCount: postedTransactions.filter((transaction) => !transaction.category_id).length,
    upcomingObligations,
    goals,
  });
};

const retrievePreferences = async (service: SupabaseClient, userId: string) => {
  const { data, error } = await service
    .from('weekly_checkin_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('preferences_unavailable');
  return data as Preferences | null;
};

const channelAllowed = (preferences: Preferences | null, channel: Delivery['channel']) =>
  Boolean(
    preferences?.opted_in &&
    !preferences.paused &&
    (channel === 'in_app'
      ? preferences.in_app_enabled
      : preferences.email_enabled && preferences.email_delivery_state === 'active'),
  );

export const createEmail = (
  summary: WeeklyCheckInSummary,
  detailed: boolean,
  actionUrl: string,
  recipient: string,
) => {
  const formatMoney = (amountMinor: number) =>
    new Intl.NumberFormat(summary.locale ?? 'en', {
      style: 'currency',
      currency: summary.currencyCode ?? 'USD',
    }).format(amountMinor / 100);
  const details = detailed
    ? `<p>Actual income: ${escapeHtml(formatMoney(summary.position.actualIncomeMinor))}<br>Actual expenses: ${escapeHtml(formatMoney(summary.position.actualExpenseMinor))}<br>Available: ${escapeHtml(formatMoney(summary.position.actualRemainingMinor))}</p>`
    : '<p>Open Buddy Budget to view your private financial figures.</p>';
  return {
    Messages: [
      {
        From: {
          Email: Deno.env.get('MAILJET_FROM_EMAIL'),
          Name: Deno.env.get('MAILJET_FROM_NAME') ?? 'Buddy Budget',
        },
        To: [{ Email: recipient }],
        Subject: 'Your weekly Buddy Budget check-in',
        TextPart: `${summary.recommendation.title}. ${summary.recommendation.body} Open Buddy Budget: ${actionUrl}`,
        HTMLPart: `<h1>Your weekly check-in</h1><h2>${escapeHtml(summary.recommendation.title)}</h2><p>${escapeHtml(summary.recommendation.body)}</p>${details}<p><a href="${escapeHtml(actionUrl)}">Open Buddy Budget</a></p>`,
      },
    ],
  };
};

export const isDispatchAuthorized = (authorization: string | null, serviceKey: string) =>
  Boolean(serviceKey && authorization?.replace(/^Bearer\s+/i, '') === serviceKey);

const updateDelivery = async (
  service: SupabaseClient,
  id: string,
  values: Record<string, unknown>,
) => {
  const { error } = await service.from('notification_deliveries').update(values).eq('id', id);
  if (error) throw new Error('delivery_update_failed');
};

const processDelivery = async (service: SupabaseClient, delivery: Delivery) => {
  const preferences = await retrievePreferences(service, delivery.user_id);
  if (!channelAllowed(preferences, delivery.channel)) {
    await updateDelivery(service, delivery.id, {
      status: 'skipped',
      error_code: 'preference_disabled',
      error_summary: 'Delivery was disabled before dispatch.',
    });
    return;
  }
  const summary = await retrieveSummary(service, delivery.user_id);
  if (delivery.channel === 'in_app') {
    await updateDelivery(service, delivery.id, {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      summary_payload: summary,
      action_path: summary.recommendation.actionPath,
    });
    return;
  }
  const { data, error } = await service.auth.admin.getUserById(delivery.user_id);
  if (error || !data.user?.email) throw new Error('recipient_unavailable');
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  const apiKey = Deno.env.get('MAILJET_API_KEY');
  const secretKey = Deno.env.get('MAILJET_SECRET_KEY');
  if (!appBaseUrl || !apiKey || !secretKey || !Deno.env.get('MAILJET_FROM_EMAIL'))
    throw new Error('provider_not_configured');
  const actionUrl = `${appBaseUrl.replace(/\/$/, '')}/${summary.recommendation.actionPath.replace(/^\//, '')}`;
  let response: Response;
  try {
    response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${apiKey}:${secretKey}`)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        createEmail(
          summary,
          Boolean(preferences?.email_detail_enabled),
          actionUrl,
          data.user.email,
        ),
      ),
    });
  } catch {
    await updateDelivery(service, delivery.id, {
      status: 'failed_final',
      error_code: 'provider_outcome_unknown',
      error_summary: 'The provider outcome was uncertain, so this email was not retried.',
    });
    return;
  }
  if (!response.ok) {
    const retryable = response.status === 429;
    await updateDelivery(service, delivery.id, {
      status: retryable && delivery.attempt_count < 3 ? 'failed' : 'failed_final',
      next_attempt_at:
        retryable && delivery.attempt_count < 3
          ? new Date(Date.now() + 15 * 60_000 * delivery.attempt_count).toISOString()
          : null,
      error_code: `mailjet_${response.status}`,
      error_summary: retryable
        ? 'Email provider temporarily unavailable; delivery will retry.'
        : 'Email provider rejected the delivery.',
    });
    return;
  }
  const providerResult = (await response.json().catch(() => null)) as {
    Messages?: Array<{ Status?: string; To?: Array<{ MessageID?: number }> }>;
  } | null;
  if (providerResult?.Messages?.[0]?.Status !== 'success') {
    await updateDelivery(service, delivery.id, {
      status: 'failed_final',
      error_code: 'mailjet_message_rejected',
      error_summary: 'Email provider rejected the message.',
    });
    return;
  }
  await updateDelivery(service, delivery.id, {
    status: 'delivered',
    delivered_at: new Date().toISOString(),
    provider_message_id:
      String(providerResult?.Messages?.[0]?.To?.[0]?.MessageID ?? '').slice(0, 200) || null,
    action_path: summary.recommendation.actionPath,
    summary_payload: { recommendation: summary.recommendation },
  });
};

const processDeliverySafely = async (service: SupabaseClient, delivery: Delivery) => {
  try {
    await processDelivery(service, delivery);
  } catch (error) {
    const retryable = delivery.attempt_count < 3;
    await updateDelivery(service, delivery.id, {
      status: retryable ? 'failed' : 'failed_final',
      next_attempt_at: retryable
        ? new Date(Date.now() + 15 * 60_000 * delivery.attempt_count).toISOString()
        : null,
      error_code: error instanceof Error ? error.message.slice(0, 64) : 'delivery_failed',
      error_summary: retryable
        ? 'Delivery could not start and will be retried.'
        : 'Delivery could not be completed after three attempts.',
    });
  }
};

const createService = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('server_not_configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

export const handler = async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: string; channel?: string };
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const service = createService();
    if (body.mode === 'dispatch') {
      if (!isDispatchAuthorized(authorization, serviceKey))
        return json({ error: 'Forbidden' }, 403);
      const { data, error } = await service.rpc('claim_due_weekly_checkins', {
        requested_limit: 25,
      });
      if (error) throw new Error('claim_failed');
      for (const delivery of (data ?? []) as Delivery[])
        await processDeliverySafely(service, delivery);
      return json({ processed: data?.length ?? 0 });
    }
    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
    if (body.mode === 'preview') {
      return json({ summary: await retrieveSummary(service, userData.user.id) });
    }
    if (body.mode === 'test' && (body.channel === 'in_app' || body.channel === 'email')) {
      const { data, error } = await client.rpc('create_test_checkin_delivery', {
        requested_channel: body.channel,
      });
      if (error || !data?.[0])
        return json({ error: error?.message ?? 'Test could not start' }, 400);
      await processDeliverySafely(service, data[0] as Delivery);
      const { data: completed } = await service
        .from('notification_deliveries')
        .select('status,error_summary')
        .eq('id', data[0].id)
        .single();
      if (completed?.status !== 'delivered')
        return json({ error: completed?.error_summary ?? 'Test delivery failed.' }, 502);
      return json({ delivered: true });
    }
    return json({ error: 'Invalid request' }, 400);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'weekly_checkin_failed');
    return json({ error: 'The check-in could not be completed.' }, 500);
  }
};

if (import.meta.main) Deno.serve(handler);
