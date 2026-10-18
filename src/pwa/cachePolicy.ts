export const pwaPrecachePatterns = ['**/*.{js,css,html,svg,woff2}', 'icons/icon-{192,512}.png'];

export const pwaNavigationFallbackDenylist = [
  /\/auth(?:\/|$)/,
  /\/rest\/v1(?:\/|$)/,
  /\/functions\/v1(?:\/|$)/,
  /\/storage\/v1(?:\/|$)/,
  /supabase\.co/,
  /\/exports?(?:\/|$)/,
];

export const pwaRuntimeCaching = [];
