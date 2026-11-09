import type { StoreProductTag } from '@medusajs/types';
import { describe, expect, it, vi } from 'vitest';
import { collectTags, getTagsWithDescendants } from '../utils/taxonomy.js';

function tag(id: string, concept: string | null, parent?: string): StoreProductTag {
  return { id, value: id, external_id: concept, created_at: '', updated_at: '', metadata: parent ? { parent } : {} };
}

describe('collectTags', () => {
  it('reads every page and keeps what passes', async () => {
    const pages = [
      { product_tags: [tag('1', 'a/1'), tag('2', 'b/1')], count: 3 },
      { product_tags: [tag('3', 'a/2')], count: 3 },
    ];
    const listPage = vi.fn(async ({ offset }: { limit: number; offset: number }) => pages[offset / 2]);
    const tags = await collectTags(listPage, (t) => String(t.external_id).startsWith('a/'), 2);
    expect(tags.map((t) => t.id)).toEqual(['1', '3']);
    expect(listPage).toHaveBeenCalledTimes(2);
    expect(listPage).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
  });

  it('stops at an empty page, so a count that is too high does not loop', async () => {
    const listPage = vi.fn().mockResolvedValue({ product_tags: [], count: 1000 });
    expect(await collectTags(listPage, () => true, 100)).toEqual([]);
    expect(listPage).toHaveBeenCalledOnce();
  });
});

describe('getTagsWithDescendants', () => {
  const tags = [tag('1', 'v/top'), tag('2', 'v/mid', 'v/top'), tag('3', 'v/leaf', 'v/mid'), tag('4', 'v/other', 'v/top'), tag('5', 'v/alone')];
  const ids = (key: string) => getTagsWithDescendants(tags, key, 'en').map((t) => t.id);

  it('has the concept and everything below it, at any depth', () => {
    expect(ids('v/top').sort()).toEqual(['1', '2', '3', '4']);
    expect(ids('v/mid').sort()).toEqual(['2', '3']);
    expect(ids('v/leaf')).toEqual(['3']);
  });

  it('has only the tag of a concept without children, and nothing for an unknown concept', () => {
    expect(ids('v/alone')).toEqual(['5']);
    expect(ids('v/nothing')).toEqual([]);
  });

  it('ends a loop of parents', () => {
    const loop = [tag('1', 'v/a', 'v/b'), tag('2', 'v/b', 'v/a')];
    expect(getTagsWithDescendants(loop, 'v/a', 'en').map((t) => t.id).sort()).toEqual(['1', '2']);
  });

  it('skips tags that are no concepts', () => {
    const mixed = [...tags, tag('9', null)];
    expect(getTagsWithDescendants(mixed, 'v/top', 'en')).toHaveLength(4);
  });
});
