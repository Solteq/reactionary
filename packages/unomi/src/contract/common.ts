import * as z from 'zod';

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/).meta({ description: 'ISO 4217 currency code, upper case.' });

export const AmountSchema = z.number().min(0);

export const ConceptIdsSchema = z.array(z.string().max(128)).meta({
  description: 'Ids of the taxonomy concepts of the item, "<vocabulary>/<slug>". Ancestors may or may not be included. Empty when the item has none.',
});

export const CategoryIdsSchema = z.array(z.string()).meta({
  description: 'Ids of the categories of the item, parents included, from the root down. Empty when the item has none.',
});

/**
 * An ISO 8601 date and time, `YYYY-MM-DDTHH:MM:SS[.s...]` followed by `Z` or an offset (`+02:00`, `-0500`, `+02`).
 * Only the shape is checked, not that the date exists.
 */
export const IsoDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/)
  .meta({ description: 'ISO 8601 date and time with a timezone designator, e.g. 2026-10-29T13:45:09.123Z or 2026-10-29T15:45:09+02:00.' });

/** A lowercase slug of at most `max` characters: letters, digits, `-` and `_`, starting with a letter or digit. */
export const slug = (max: number): z.ZodString => z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).max(max);

export const OriginTypeSchema = z.enum([
  'search',
  'autocomplete',
  'category',
  'list',
  'associations',
  'product-list',
  'promotion',
  'content',
  'cart',
  'order',
  'quick-order',
  'direct',
  'pdp',
]).meta({ description: 'The surface the visitor came from. Same values as reactionary\'s analytics origin.' });

/**
 * Where the visitor met the item. Flat on purpose: Unomi conditions address plain paths such as
 * `properties.origin.term`. Position is left out, it says nothing about intent.
 */
export const OriginPropertiesSchema = z.object({
  type: OriginTypeSchema,
  term: z.string().optional().meta({ description: 'Search term (search, autocomplete).' }),
  filters: z.array(z.string()).optional().meta({ description: 'Facet values that were active, as "facet:value".' }),
  categoryId: z.string().optional(),
  carouselName: z.string().optional(),
  promotionId: z.string().optional(),
  slot: z.string().optional().meta({ description: 'Placement of the promotion or content, e.g. "hero".' }),
  contentId: z.string().optional(),
  listId: z.string().optional(),
  productId: z.string().optional().meta({ description: 'The product whose associations were shown (associations).' }),
});

export const DeviceClassSchema = z.enum(['mobile', 'tablet', 'desktop']).meta({ description: 'Coarse device class of the visitor.' });

/**
 * Properties on every event. Money fields elsewhere come in pairs: the amount in `currency` and the same in EUR, converted at
 * `fxRate` of `fxDate`. The EUR fields and the rate are left out together when no rate is known.
 */
export const EventCommonPropertiesSchema = z.object({
  locale: z.string().meta({ description: 'Locale of the request, e.g. "da-DK".' }),
  currency: CurrencyCodeSchema.meta({ description: 'Currency of the storefront request, ISO 4217.' }),
  device: DeviceClassSchema.optional(),
  origin: OriginPropertiesSchema.optional(),
  fxRate: z.number().positive().optional().meta({ description: 'EUR per one unit of `currency`, as used for the EUR amounts on this event. ECB euro reference rate of `fxDate`.' }),
  fxDate: IsoDateTimeSchema.optional().meta({ description: 'When the exchange rate applies. The ECB publishes one rate per day, so this is the start of that day.' }),
});

export type EventCommonProperties = z.infer<typeof EventCommonPropertiesSchema>;

export type OriginProperties = z.infer<typeof OriginPropertiesSchema>;
