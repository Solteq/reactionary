export function getLanguageCodeFromLocale(locale: string): string {
  return locale.split('-')[0];
}
