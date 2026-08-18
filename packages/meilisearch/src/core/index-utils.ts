export function getProductIndexNameForLocale(baseIndexName: string, locale: string): string {
  const localeShortCode = locale.split('-')[0];
  return `${baseIndexName}_${localeShortCode}`;
}
