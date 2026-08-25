import { createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import {
  extractStoreViewLanguage,
  getRequestLocale,
  resolveMagentoStoreViewCode,
  resolveMagentoStoreViewCodeForContext,
} from '../utils/magento-store-view.js';

describe('extractStoreViewLanguage', () => {
  it.each([
    ['da-DK', 'da'],
    ['en-US', 'en'],
    ['pl-PL', 'pl'],
    ['sv-SE', 'sv'],
    ['sv_SE', 'sv'],
    ['SV-se', 'sv'],
    ['  fi-FI  ', 'fi'],
    ['de', 'de'],
  ])('reads the language out of %s', (locale, expected) => {
    expect(extractStoreViewLanguage(locale)).toBe(expected);
  });

  it.each([undefined, null, '', '   ', 'x-DK', '1a', 42, {}])(
    'yields undefined for %s',
    (locale) => {
      expect(extractStoreViewLanguage(locale)).toBeUndefined();
    },
  );
});

describe('resolveMagentoStoreViewCode', () => {
  it('appends the language to the base store code', () => {
    expect(resolveMagentoStoreViewCode('b2c', 'da-DK')).toBe('b2c-da');
  });

  it('falls back to the base store code when the locale is unusable', () => {
    expect(resolveMagentoStoreViewCode('b2c')).toBe('b2c');
    expect(resolveMagentoStoreViewCode('b2c', '')).toBe('b2c');
    expect(resolveMagentoStoreViewCode('b2c', '-')).toBe('b2c');
    expect(resolveMagentoStoreViewCode('b2c', null)).toBe('b2c');
  });

  it('yields an empty code when no base store code is configured', () => {
    expect(resolveMagentoStoreViewCode('', 'da-DK')).toBe('');
    expect(resolveMagentoStoreViewCode('   ', 'da-DK')).toBe('');
    expect(resolveMagentoStoreViewCode(undefined, 'da-DK')).toBe('');
  });

  it('trims a padded base store code', () => {
    expect(resolveMagentoStoreViewCode('  b2c  ', 'sv-SE')).toBe('b2c-sv');
  });
});

describe('resolveMagentoStoreViewCodeForContext', () => {
  it('uses the locale carried on the request context', () => {
    const context = createInitialRequestContext();
    context.languageContext.locale = 'pl-PL';
    expect(resolveMagentoStoreViewCodeForContext('b2c', context)).toBe('b2c-pl');
  });

  it('falls back to the base store code without a context', () => {
    expect(resolveMagentoStoreViewCodeForContext('b2c')).toBe('b2c');
  });
});

describe('getRequestLocale', () => {
  it('returns undefined for a blank locale', () => {
    const context = createInitialRequestContext();
    context.languageContext.locale = '   ';
    expect(getRequestLocale(context)).toBeUndefined();
  });
});
