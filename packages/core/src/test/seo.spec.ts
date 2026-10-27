import { describe, expect, it } from 'vitest';
import { CategorySchema } from '../schemas/models/category.model.js';
import { SeoSchema } from '../schemas/models/seo.model.js';
import { resolveSeo } from '../utils/seo.js';

describe('SeoSchema', () => {
  it('accepts an empty object, as nothing is authored by default', () => {
    expect(SeoSchema.parse({})).toEqual({});
  });

  it('keeps provider specific extras', () => {
    expect(SeoSchema.parse({ title: 'T', canonical: '/x' })).toEqual({ title: 'T', canonical: '/x' });
  });

  it('is optional on category', () => {
    const category = { identifier: { key: 'coffee' } };
    expect(CategorySchema.parse(category).seo).toBeUndefined();
    expect(CategorySchema.parse({ ...category, seo: { title: 'T' } }).seo).toEqual({ title: 'T' });
  });
});

describe('resolveSeo', () => {
  const fallbacks = { fallbackTitle: 'Coffee Maker', fallbackDescription: 'A fine coffee maker.' };

  it('prefers authored values over fallbacks', () => {
    expect(
      resolveSeo({ ...fallbacks, seo: { title: 'Buy a coffee maker', description: 'Authored.', robots: 'noindex, follow' } }),
    ).toEqual({ title: 'Buy a coffee maker', description: 'Authored.', robots: 'noindex, follow' });
  });

  it('falls back when nothing is authored', () => {
    expect(resolveSeo(fallbacks)).toEqual({ title: 'Coffee Maker', description: 'A fine coffee maker.' });
  });

  it('treats blank authored values as not authored', () => {
    expect(resolveSeo({ ...fallbacks, seo: { title: '  ', description: '', robots: ' ' } })).toEqual({
      title: 'Coffee Maker',
      description: 'A fine coffee maker.',
    });
  });

  it('strips html and collapses whitespace in the fallback description', () => {
    const result = resolveSeo({
      fallbackTitle: 'T',
      fallbackDescription: '<p>Fast &amp; quiet</p>\n<ul><li>1 L</li>  <li>Black</li></ul><script>alert(1)</script>',
    });
    expect(result.description).toBe('Fast & quiet 1 L Black');
  });

  it('decodes entities once, so escaped markup stays literal text', () => {
    const { description } = resolveSeo({
      fallbackTitle: 'T',
      fallbackDescription: '&amp;lt;b&amp;gt; &#8211; &#x2013; caf&eacute;',
    });
    expect(description).toBe('&lt;b&gt; \u2013 \u2013 caf&eacute;');
  });

  it('cuts the fallback description at a word boundary', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const { description } = resolveSeo({ fallbackTitle: 'T', fallbackDescription: words });
    expect(description.length).toBeLessThanOrEqual(156);
    expect(description.endsWith('…')).toBe(true);
    expect(words.startsWith(description.slice(0, -1))).toBe(true);
    expect(words.charAt(description.length - 1)).toBe(' ');
  });

  it('does not truncate an authored description', () => {
    const long = 'x '.repeat(200).trim();
    expect(resolveSeo({ ...fallbacks, seo: { description: long } }).description).toBe(long);
  });

  it('lets forced robots replace the authored directive', () => {
    expect(resolveSeo({ ...fallbacks, seo: { robots: 'index' }, forcedRobots: 'noindex' }).robots).toBe('noindex');
  });

  it('omits robots when neither authored nor forced', () => {
    expect(resolveSeo(fallbacks)).not.toHaveProperty('robots');
  });
});
