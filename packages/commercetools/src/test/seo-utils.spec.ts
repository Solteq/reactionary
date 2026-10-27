import { describe, expect, it } from 'vitest';
import { parseCommercetoolsSeo } from '../core/seo-utils.js';

describe('parseCommercetoolsSeo', () => {
  const data = {
    metaTitle: { da: 'Dansk titel', en: 'English title' },
    metaDescription: { en: 'English description' },
  };

  it('maps the authored values for the requested language', () => {
    expect(parseCommercetoolsSeo('en', data)).toEqual({
      title: 'English title',
      description: 'English description',
    });
  });

  it('leaves out values not authored in that language, without borrowing another', () => {
    expect(parseCommercetoolsSeo('da', data)).toEqual({ title: 'Dansk titel' });
  });

  it('returns undefined when nothing is authored', () => {
    expect(parseCommercetoolsSeo('fi', data)).toBeUndefined();
    expect(parseCommercetoolsSeo('en', {})).toBeUndefined();
  });

  it('treats blank values as not authored', () => {
    expect(parseCommercetoolsSeo('en', { metaTitle: { en: '  ' } })).toBeUndefined();
  });
});
