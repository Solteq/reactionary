import type { StoreProduct } from '@medusajs/types';
import { ProductFlagSchema, type ProductTerm } from '@reactionary/core';
import * as z from 'zod';

/**
 * The attribute definitions that recalcitrant stores in the metadata of a product type.
 * The parsing is lenient, a definition that does not fit is dropped rather than failing the product.
 */
export const MedusaAttributeDefinitionSchema = z.looseObject({
  key: z.string(),
  names: z.record(z.string(), z.string()).default({}),
  groups: z.record(z.string(), z.string()).default({}),
  unit: z.record(z.string(), z.string()).default({}),
  order: z.number().default(0),
  data_type: z.string().optional(),
});

export type MedusaAttributeDefinition = z.infer<typeof MedusaAttributeDefinitionSchema>;

type MedusaTag = NonNullable<StoreProduct['tags']>[number];

/**
 * Picks the best entry of a map of localized strings: the exact locale, its language, en, then any.
 */
export function pickLocalized(values: Record<string, string> | undefined, locale: string): string | undefined {
  if (!values) {
    return undefined;
  }
  const language = locale.split(/[-_]/)[0];
  const candidates = [locale, language, 'en'];
  for (const candidate of candidates) {
    const match = values[candidate];
    if (match) {
      return match;
    }
  }
  const lowered = Object.entries(values).find(([key]) => key.toLowerCase().split(/[-_]/)[0] === language.toLowerCase() && values[key]);
  if (lowered) {
    return lowered[1];
  }
  return Object.values(values).find((value) => !!value);
}

/**
 * Reads the attribute definitions from the metadata of a product type.
 * Medusa may hand the JSON array over as a JSON encoded string.
 */
export function parseAttributeDefinitions(raw: unknown): Map<string, MedusaAttributeDefinition> {
  const definitions = new Map<string, MedusaAttributeDefinition>();
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return definitions;
    }
  }
  if (!Array.isArray(list)) {
    return definitions;
  }
  for (const entry of list) {
    const parsed = MedusaAttributeDefinitionSchema.safeParse(entry);
    if (parsed.success) {
      definitions.set(parsed.data.key, parsed.data);
    }
  }
  return definitions;
}

/**
 * Reads the comma separated flag list of a product and drops everything outside of the closed list.
 */
export function parseFlags(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  const flags: string[] = [];
  for (const candidate of raw.split(',')) {
    const parsed = ProductFlagSchema.safeParse(candidate.trim());
    if (parsed.success && !flags.includes(parsed.data)) {
      flags.push(parsed.data);
    }
  }
  return flags;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  const parsed = z.record(z.string(), z.string()).safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Maps a Medusa product tag to a term. The id lives in external_id (or metadata.term_id), the tag value is
 * the term name and is translated by Medusa for the request locale. Tags without a term id are no terms.
 */
export function parseTagAsTerm(tag: MedusaTag, locale: string): ProductTerm | undefined {
  const metadata = tag.metadata ?? {};
  const id = asString(tag.external_id) ?? asString(metadata['term_id']);
  if (!id) {
    return undefined;
  }
  const slashIndex = id.indexOf('/');
  const vocabulary = asString(metadata['vocabulary']) ?? (slashIndex > 0 ? id.slice(0, slashIndex) : '');
  const slug = slashIndex >= 0 ? id.slice(slashIndex + 1) : id;
  const name = asString(tag.value) ?? pickLocalized(asStringRecord(metadata['names']), locale) ?? slug;
  const parent = asString(metadata['parent']);

  const term: ProductTerm = {
    identifier: { key: id },
    vocabulary,
    name,
  };
  if (parent) {
    term.parent = { key: parent };
  }
  return term;
}
