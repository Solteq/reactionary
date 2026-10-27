import type { StoreProduct } from '@medusajs/types';
import { ProductFlagSchema, type ProductConcept } from '@reactionary/core';
import * as z from 'zod';

/**
 * The attribute definitions that recalcitrant stores in the metadata of a product type.
 * The parsing is lenient, a definition that does not fit is dropped rather than failing the product.
 */
/**
 * A map of localized strings. The producer is written in Go and emits null for nil maps.
 */
const LocalizedStringsSchema = z
  .record(z.string(), z.string())
  .nullish()
  .transform((value) => value ?? {});

/**
 * A unit is a map per locale, or a plain string that is the unit for every locale.
 */
const UnitSchema = z
  .union([z.string(), z.record(z.string(), z.string())])
  .nullish()
  .transform((value): Record<string, string> => {
    if (typeof value === 'string') {
      return value === '' ? {} : { '*': value };
    }
    return value ?? {};
  });

const OrderSchema = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    const order = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof order === 'number' && Number.isFinite(order) ? order : 0;
  });

export const MedusaAttributeDefinitionSchema = z.looseObject({
  key: z.string().min(1),
  names: LocalizedStringsSchema,
  groups: LocalizedStringsSchema,
  unit: UnitSchema,
  order: OrderSchema,
  data_type: z
    .string()
    .nullish()
    .transform((value) => value || undefined),
});

export type MedusaAttributeDefinition = z.output<typeof MedusaAttributeDefinitionSchema>;

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
 * The name from the metadata map names of a product type or tag, for the request locale: the exact locale,
 * its language, then en. Returns undefined when the map has none of them, the caller then falls back to the
 * (possibly translated) value. This is deterministic and works without Medusa's translation module.
 */
export function pickMetadataName(metadata: Record<string, unknown> | null | undefined, locale: string): string | undefined {
  const names = asStringRecord(metadata?.['names']);
  if (!names) {
    return undefined;
  }
  const language = locale.split(/[-_]/)[0];
  return names[locale] || names[language] || names['en'] || undefined;
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
 * Maps a Medusa product tag to a concept. The id lives in external_id (or metadata.concept_id), the name comes
 * from metadata.names for the request locale, then the tag value (translated by Medusa when it can). Tags
 * without a concept id are no concepts.
 */
export function parseTagAsConcept(tag: MedusaTag, locale: string): ProductConcept | undefined {
  const metadata = tag.metadata ?? {};
  const id = asString(tag.external_id) ?? asString(metadata['concept_id']);
  if (!id) {
    return undefined;
  }
  const slashIndex = id.indexOf('/');
  const vocabulary = asString(metadata['vocabulary']) ?? (slashIndex > 0 ? id.slice(0, slashIndex) : '');
  const slug = slashIndex >= 0 ? id.slice(slashIndex + 1) : id;
  const name = pickMetadataName(metadata, locale) ?? asString(tag.value) ?? slug;
  const parent = asString(metadata['parent']);
  const notation = asString(metadata['notation']);

  const concept: ProductConcept = {
    identifier: { key: id },
    vocabulary,
    name,
  };
  if (parent) {
    concept.parent = { key: parent };
  }
  if (notation) {
    concept.notation = notation;
  }
  return concept;
}

/**
 * The synonyms of a tag in the request locale, falling back to en and then to any other locale.
 */
export function parseTagSynonyms(tag: MedusaTag, locale: string): string[] {
  const parsed = z.record(z.string(), z.array(z.string())).safeParse(tag.metadata?.['synonyms']);
  if (!parsed.success) {
    return [];
  }
  const language = locale.split(/[-_]/)[0];
  const synonyms = parsed.data[locale] ?? parsed.data[language] ?? parsed.data['en'] ?? Object.values(parsed.data)[0];
  return synonyms ?? [];
}

/**
 * The definition of a tag in the request locale, from the metadata.definition map: locale, language, then en.
 * A plain string is taken as the definition for every locale.
 */
export function parseTagDefinition(tag: MedusaTag, locale: string): string | undefined {
  const raw = tag.metadata?.['definition'];
  if (typeof raw === 'string') {
    return raw === '' ? undefined : raw;
  }
  const definitions = asStringRecord(raw);
  if (!definitions) {
    return undefined;
  }
  const language = locale.split(/[-_]/)[0];
  return definitions[locale] || definitions[language] || definitions['en'] || undefined;
}

/**
 * The ids of the concepts a tag is related to, from metadata.related. Entries that are not non-empty
 * strings are ignored, as are duplicates and a reference to the concept itself.
 */
export function parseTagRelated(tag: MedusaTag, conceptId: string): string[] {
  const raw = tag.metadata?.['related'];
  if (!Array.isArray(raw)) {
    return [];
  }
  const related: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry !== '' && entry !== conceptId && !related.includes(entry)) {
      related.push(entry);
    }
  }
  return related;
}
