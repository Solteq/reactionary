import * as z from 'zod';
import { AmountSchema, CategoryIdsSchema, ConceptIdsSchema, CurrencyCodeSchema, slug } from './common.js';

export interface ItemDefinition {
  /** Item type and schema name, lowerCamelCase. */
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** When set, the `itemId` must match this pattern. Rules can only copy a whole field, so a combined value is made the id. */
  readonly itemIdPattern?: string;
  /** The `properties` of the item. `itemId` and `itemType` come from the Unomi item base schema. */
  readonly properties: z.ZodObject;
}

export const ProductPropertiesSchema = z.object({
  name: z.string().meta({ description: 'Product name, for readable reports. Not for matching.' }),
  brand: z.string().optional().meta({ description: 'Brand of the product. Left out when the product has none.' }),
  productType: z.string().optional().meta({ description: 'Product type (the most specific kind of product), when the platform has one.' }),
  categoryIds: CategoryIdsSchema,
  conceptIds: ConceptIdsSchema,
  price: AmountSchema.optional().meta({ description: 'Unit price in `currency` when the event was sent. Left out when no price was available.' }),
  priceEur: AmountSchema.optional().meta({ description: '`price` in EUR at the rate of the event (`fxRate`).' }),
  currency: CurrencyCodeSchema.optional(),
  onSale: z.boolean().optional().meta({ description: 'The price is discounted.' }),
});

/** A product as it sits in a cart or an order: the product plus the variant and what was asked for. */
export const LinePropertiesSchema = ProductPropertiesSchema.extend({
  sku: z.string().meta({ description: 'The variant.' }),
  quantity: z.number().positive(),
  unitPrice: AmountSchema.optional().meta({ description: 'Price of one unit in `currency`.' }),
  unitPriceEur: AmountSchema.optional(),
});

export const CategoryPropertiesSchema = z.object({
  name: z.string(),
  categoryIds: CategoryIdsSchema.meta({ description: 'The category and its parents, from the root down.' }),
});

export const ContentPropertiesSchema = z.object({
  contentType: z.string().optional().meta({ description: 'Kind of content, e.g. "article" or "landing-page".' }),
  conceptIds: ConceptIdsSchema,
});

export const PromotionPropertiesSchema = z.object({
  name: z.string(),
  slot: z.string().meta({ description: 'Placement of the promotion, e.g. "hero".' }),
  creative: z.string().optional(),
});

export const StorePropertiesSchema = z.object({
  name: z.string(),
  country: z.string().regex(/^[A-Z]{2}$/).optional().meta({ description: 'ISO 3166-1 alpha-2.' }),
  region: z.string().optional(),
  city: z.string().optional(),
});

export const CartPropertiesSchema = z.object({
  itemCount: z.int().min(0),
  value: AmountSchema.meta({ description: 'Total of the cart in `currency`.' }),
  valueEur: AmountSchema.optional(),
  currency: CurrencyCodeSchema,
});

export const OrderPropertiesSchema = z.object({
  itemCount: z.int().min(0),
  total: AmountSchema.meta({ description: 'Grand total in `currency`.' }),
  totalEur: AmountSchema.optional(),
  currency: CurrencyCodeSchema,
  lines: z.array(LinePropertiesSchema).meta({ description: 'The order lines. Unomi cannot match inside an array of objects, use the flat arrays below in conditions.' }),
  productIds: z.array(z.string()).meta({ description: 'Product keys of all lines.' }),
  categoryIds: CategoryIdsSchema.meta({ description: 'Categories of all lines, parents included, deduplicated.' }),
  brands: z.array(z.string()).meta({ description: 'Brands of all lines, deduplicated.' }),
  conceptIds: ConceptIdsSchema.meta({ description: 'Concepts of all lines, deduplicated.' }),
  couponCodes: z.array(z.string()).meta({ description: 'Coupon codes used. Empty when none.' }),
  deliveryMethod: z.string().optional().meta({ description: 'Chosen delivery method, e.g. "home" or "pickup".' }),
  shippingCountry: z.string().regex(/^[A-Z]{2}$/).optional().meta({ description: 'ISO 3166-1 alpha-2 of the shipping address.' }),
  shippingPostalArea: z.string().optional().meta({ description: 'The postal code of the shipping address cut to an area, per country. Never the full code, never the street.' }),
});

export const ExperimentPropertiesSchema = z.object({
  experimentKey: slug(40).meta({ description: 'The experiment, as defined in the CMS.' }),
  version: slug(12).meta({ description: 'The version the visitor was shown, control included.' }),
});

export const TraitPropertiesSchema = z.object({
  trait: slug(29).meta({ description: 'What was declared, e.g. "trade".' }),
  value: slug(29).meta({ description: 'The declared value, e.g. "electrician". A concept slug when the trait mirrors a taxonomy vocabulary.' }),
});

/** `exp.<experimentKey>.<version>`: a whole version of an experiment, which is also the key of its CDP segment. */
export const EXPERIMENT_ITEM_ID_PATTERN = '^exp\\.[a-z0-9][a-z0-9_-]*\\.[a-z0-9][a-z0-9_-]*$';
/** `<trait>.<value>` */
export const TRAIT_ITEM_ID_PATTERN = '^[a-z0-9][a-z0-9_-]*\\.[a-z0-9][a-z0-9_-]*$';

export const itemDefinitions = [
  { name: 'product', title: 'Product', description: 'A product, as the visitor met it.', properties: ProductPropertiesSchema },
  { name: 'line', title: 'Line', description: 'A product with the variant and quantity, in a cart or an order.', properties: LinePropertiesSchema },
  { name: 'category', title: 'Category', description: 'A category of the catalog.', properties: CategoryPropertiesSchema },
  { name: 'content', title: 'Content', description: 'A piece of CMS content that is not a commerce entity.', properties: ContentPropertiesSchema },
  { name: 'promotion', title: 'Promotion', description: 'A promotion shown on the storefront.', properties: PromotionPropertiesSchema },
  { name: 'store', title: 'Store', description: 'A physical store. Region only, no coordinates.', properties: StorePropertiesSchema },
  { name: 'cart', title: 'Cart', description: 'A cart at the time of the event.', properties: CartPropertiesSchema },
  { name: 'order', title: 'Order', description: 'An order with its lines and the flat arrays used for matching.', properties: OrderPropertiesSchema },
  {
    name: 'experiment',
    title: 'Experiment',
    description: 'An experiment version the visitor was exposed to. The itemId is exp.<experimentKey>.<version>.',
    itemIdPattern: EXPERIMENT_ITEM_ID_PATTERN,
    properties: ExperimentPropertiesSchema,
  },
  {
    name: 'trait',
    title: 'Trait',
    description: 'Something the visitor declared about themselves. The itemId is <trait>.<value>.',
    itemIdPattern: TRAIT_ITEM_ID_PATTERN,
    properties: TraitPropertiesSchema,
  },
] as const satisfies readonly ItemDefinition[];

export type ItemName = (typeof itemDefinitions)[number]['name'];
