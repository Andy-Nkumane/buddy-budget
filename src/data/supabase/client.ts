import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

const browserConfigurationSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith('https://') ||
        /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(value),
      {
        message: 'Supabase URL must use HTTPS (or a loopback address for development).',
      },
    ),
  publishableKey: z.string().min(10),
});

const configurationResult = browserConfigurationSchema.safeParse({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

export const configurationError = configurationResult.success
  ? null
  : 'BuddyBudget is not connected to Supabase. Configure the project URL and browser-safe publishable key for this environment.';

export const supabase = configurationResult.success
  ? createClient<Database>(configurationResult.data.url, configurationResult.data.publishableKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const requireSupabase = () => {
  if (!supabase) throw new Error(configurationError ?? 'Supabase is unavailable.');
  return supabase;
};
