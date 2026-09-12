export interface PreferenceOption {
  value: string;
  label: string;
}

const fallbackCurrencies = ['AUD', 'BWP', 'CAD', 'EUR', 'GBP', 'JPY', 'NAD', 'NZD', 'USD', 'ZAR'];
const fallbackTimezones = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Chicago',
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
];
const localeCandidates = [
  'af-ZA',
  'ar-AE',
  'ar-EG',
  'ar-SA',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-US',
  'en-ZA',
  'es-ES',
  'es-MX',
  'fi-FI',
  'fr-CA',
  'fr-FR',
  'he-IL',
  'hi-IN',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'ms-MY',
  'nl-NL',
  'no-NO',
  'nso-ZA',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'st-ZA',
  'sv-SE',
  'th-TH',
  'tn-ZA',
  'tr-TR',
  'uk-UA',
  've-ZA',
  'vi-VN',
  'xh-ZA',
  'zu-ZA',
];

const displayLocale = navigator.language || 'en-ZA';
const currencyNames = new Intl.DisplayNames([displayLocale], { type: 'currency' });
const localeNames = new Intl.DisplayNames([displayLocale], { type: 'language' });

const resolveSupportedValues = (key: 'currency' | 'timeZone', fallback: string[]): string[] => {
  try {
    return Intl.supportedValuesOf(key);
  } catch {
    return fallback;
  }
};

export const currencyOptions: PreferenceOption[] = resolveSupportedValues(
  'currency',
  fallbackCurrencies,
).map((currency) => ({
  value: currency,
  label: `${currency} - ${currencyNames.of(currency) ?? currency}`,
}));

export const localeOptions: PreferenceOption[] = Intl.DateTimeFormat.supportedLocalesOf(
  localeCandidates,
)
  .map((locale) => ({ value: locale, label: localeNames.of(locale) ?? locale }))
  .sort((left, right) => left.label.localeCompare(right.label));

export const timezoneOptions: PreferenceOption[] = Array.from(
  new Set(['UTC', ...resolveSupportedValues('timeZone', fallbackTimezones)]),
).map((timezone) => ({
  value: timezone,
  label: timezone.replaceAll('_', ' '),
}));

export const includePreferenceOption = (
  options: PreferenceOption[],
  value: string,
): PreferenceOption[] =>
  options.some((option) => option.value === value)
    ? options
    : [{ value, label: value }, ...options];
