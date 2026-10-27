import { describe, expect, it } from 'vitest';
import { createInitialRequestContext, NoOpCache } from '@reactionary/core';
import { CommercetoolsTaxonomyCapability } from '../capabilities/taxonomy.capability.js';

describe('CommercetoolsTaxonomyCapability', () => {
  const capability = new CommercetoolsTaxonomyCapability(new NoOpCache(), createInitialRequestContext());

  it('reports that vocabularies are not supported', async () => {
    const result = await capability.getVocabulary({ vocabulary: { key: 'features' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'Generic', message: expect.stringContaining('taxonomy') });
    }
  });

  it('reports that terms are not supported', async () => {
    const result = await capability.getTerms({ terms: [{ key: 'features/cordless' }] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'Generic' });
    }
  });

  it('validates the payload', async () => {
    const result = await capability.getTerms({ terms: [{ key: '' }, { key: 'features/cordless' }] });

    expect(result.success).toBe(false);
  });
});
