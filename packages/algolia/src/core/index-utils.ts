export function getProductIndexNameForLocale(baseIndexName: string, locale: string): string {
  const localeShortCode = locale.split('-')[0];
  if (localeShortCode === 'en') {
    return baseIndexName;
  }
  return `${baseIndexName}_${localeShortCode}`;
}
