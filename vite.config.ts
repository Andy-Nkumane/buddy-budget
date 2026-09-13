import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const developmentCspPlugin: Plugin = {
  name: 'buddybudget-development-csp',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html
      .replace("style-src 'self';", "style-src 'self' 'unsafe-inline';")
      .replace(" frame-ancestors 'none';", ''),
};

const normalizeBase = (value: string | undefined): string => {
  const withLeadingSlash = value?.startsWith('/') ? value : `/${value ?? ''}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const base = normalizeBase(environment.VITE_BASE_PATH || '/');

  return {
    base,
    server: { host: '0.0.0.0' },
    plugins: [
      developmentCspPlugin,
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['icons/*.png'],
        manifest: {
          id: base,
          name: 'BuddyBudget',
          short_name: 'BuddyBudget',
          description: 'Your calm monthly budgeting companion.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#f5f7f2',
          theme_color: '#194f47',
          categories: ['finance', 'productivity', 'utilities'],
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
          screenshots: [
            {
              src: `${base}screenshots/mobile-budget.png`,
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'BuddyBudget mobile preview',
            },
            {
              src: `${base}screenshots/desktop-budget.png`,
              sizes: '1440x1024',
              type: 'image/png',
              form_factor: 'wide',
              label: 'BuddyBudget desktop preview',
            },
          ],
          shortcuts: [
            { name: 'Current month', short_name: 'Current', url: `${base}app/budget/current` },
            { name: 'Months', short_name: 'Months', url: `${base}app/months` },
            { name: 'Templates', short_name: 'Templates', url: `${base}app/templates` },
            {
              name: 'Add expense',
              short_name: 'Add expense',
              url: `${base}app/budget/current?add=expense`,
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/\/auth\//, /supabase\.co/, /\/exports?\//],
          globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/icon-{192,512}.png'],
          runtimeCaching: [],
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      pool: 'vmThreads',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
      },
    },
  };
});
