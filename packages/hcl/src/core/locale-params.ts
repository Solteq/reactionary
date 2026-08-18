import type { RequestContext } from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';

export function getLocaleParams(
  config: HclConfiguration,
  context: RequestContext,
): { langId: string; currency: string } {
  return {
    langId: config.localeMap[context.languageContext.locale],
    currency: context.languageContext.currencyCode as string,
  };
}
