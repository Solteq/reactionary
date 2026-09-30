import type { AlgoliaConfiguration } from "../schema/configuration.schema.js";

export function getProductIndexNameForLocale(baseIndexName: string, locale: string, config: AlgoliaConfiguration): string {
  const localeShortCode = locale.split('-')[0];
  if (localeShortCode === 'en' && config.useBaseIndexNameForEnglishLocale) {
    return baseIndexName;
  }
  return `${baseIndexName}_${localeShortCode}`;
}
