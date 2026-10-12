import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  createShareToken,
  sanitizeSharedReportSnapshot,
  sha256Hex,
} from '../_shared/sharedReport.ts';

const securityHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, private',
  pragma: 'no-cache',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      'content-type': 'application/json;charset=utf-8',
    },
  });
const fail = (status = 400) =>
  json({ error: status === 401 ? 'authentication_required' : 'shared_report_unavailable' }, status);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
  if (request.method !== 'POST' || Number(request.headers.get('content-length') ?? 0) > 1_100_000)
    return fail(400);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400);
  }
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  if (body.action === 'view') {
    if (typeof body.token !== 'string' || body.token.length !== 43) return fail(404);
    const tokenHash = await sha256Hex(body.token);
    const codeHash =
      typeof body.accessCode === 'string' && body.accessCode
        ? await sha256Hex(`${body.token}:${body.accessCode}`)
        : null;
    const { data, error } = await service.rpc('consume_shared_budget_report', {
      requested_token_hash: tokenHash,
      requested_access_code_hash: codeHash,
    });
    if (error || !data) return fail(404);
    if (data.access_code_required === true) return json({ accessCodeRequired: true });
    return json(data);
  }

  if (body.action === 'templateView') {
    if (typeof body.token !== 'string' || body.token.length !== 43) return fail(404);
    const tokenHash = await sha256Hex(body.token);
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { data, error } = await service.rpc('consume_shared_template_link', {
      requested_token_hash: tokenHash,
      requested_visitor_hash: await sha256Hex(`${tokenHash}:${forwarded}`),
    });
    if (error || !data) return fail(404);
    return json(data);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return fail(401);
  const jwt = authorization.slice(7);
  const { data: userData, error: userError } = await service.auth.getUser(jwt);
  if (userError || !userData.user) return fail(401);
  if (body.action === 'create') {
    let snapshot;
    try {
      snapshot = sanitizeSharedReportSnapshot(body.snapshot);
    } catch {
      return fail(400);
    }
    if (!snapshot) return fail(400);
    const expiryHours = Number(body.expiryHours);
    const maxViews = body.maxViews === null ? null : Number(body.maxViews);
    const accessCode = typeof body.accessCode === 'string' ? body.accessCode : '';
    if (
      !Number.isInteger(expiryHours) ||
      expiryHours < 1 ||
      expiryHours > 2160 ||
      (maxViews !== null && (!Number.isInteger(maxViews) || maxViews < 1 || maxViews > 10000)) ||
      (accessCode && !/^\d{6,12}$/.test(accessCode))
    )
      return fail(400);
    const token = createShareToken();
    const { data, error } = await service.rpc('create_shared_budget_report', {
      requested_user_id: userData.user.id,
      requested_token_hash: await sha256Hex(token),
      requested_access_code_hash: accessCode ? await sha256Hex(`${token}:${accessCode}`) : null,
      requested_snapshot: snapshot,
      requested_expires_at: new Date(Date.now() + expiryHours * 3_600_000).toISOString(),
      requested_max_views: maxViews,
    });
    if (error || !data?.[0]) return fail(error?.code === '42501' ? 403 : 400);
    return json({ id: data[0].id, token, expiresAt: data[0].expires_at }, 201);
  }

  if (body.action === 'templateCreate') {
    if (
      typeof body.templateId !== 'string' ||
      typeof body.includeAmounts !== 'boolean' ||
      !Number.isInteger(Number(body.expiryHours)) ||
      Number(body.expiryHours) < 1 ||
      Number(body.expiryHours) > 2160
    )
      return fail(400);
    const token = createShareToken();
    const { data, error } = await service.rpc('create_shared_template_link', {
      requested_user_id: userData.user.id,
      requested_template_id: body.templateId,
      requested_token_hash: await sha256Hex(token),
      requested_include_amounts: body.includeAmounts,
      requested_expires_at: new Date(
        Date.now() + Number(body.expiryHours) * 3_600_000,
      ).toISOString(),
    });
    if (error || !data?.[0]) return fail(error?.code === '42501' ? 403 : 400);
    return json({ id: data[0].id, token, expiresAt: data[0].expires_at }, 201);
  }

  if (body.action === 'templateCopy') {
    if (
      typeof body.token !== 'string' ||
      body.token.length !== 43 ||
      typeof body.copyKey !== 'string' ||
      typeof body.templateName !== 'string' ||
      !Array.isArray(body.items)
    )
      return fail(400);
    const { data, error } = await service.rpc('copy_shared_template_link', {
      requested_user_id: userData.user.id,
      requested_token_hash: await sha256Hex(body.token),
      requested_copy_key: body.copyKey,
      requested_template_name: body.templateName,
      requested_items: body.items,
    });
    if (error || !data?.[0]) return fail(error?.code === '42501' ? 403 : 400);
    return json({ templateId: data[0].id });
  }

  if (body.action === 'templateList') {
    const { data, error } = await service.rpc('retrieve_shared_template_links', {
      requested_user_id: userData.user.id,
    });
    if (error) return fail(error.code === '42501' ? 403 : 400);
    return json({ links: data ?? [] });
  }

  if (body.action === 'templateRevoke' && typeof body.id === 'string') {
    const { data, error } = await service.rpc('revoke_shared_template_link', {
      requested_user_id: userData.user.id,
      requested_link_id: body.id,
    });
    if (error || !data) return fail(error?.code === '42501' ? 403 : 404);
    return json({ revoked: true });
  }

  if (body.action === 'list') {
    const { data, error } = await service.rpc('retrieve_shared_budget_reports', {
      requested_user_id: userData.user.id,
    });
    if (error) return fail(error.code === '42501' ? 403 : 400);
    return json({ reports: data ?? [] });
  }

  if (body.action === 'revoke' && typeof body.id === 'string') {
    const { data, error } = await service.rpc('revoke_shared_budget_report', {
      requested_user_id: userData.user.id,
      requested_report_id: body.id,
    });
    if (error || !data) return fail(error?.code === '42501' ? 403 : 404);
    return json({ revoked: true });
  }
  return fail(400);
});
