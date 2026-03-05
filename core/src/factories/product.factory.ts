import type * as z from 'zod';
import type { ProductSchema } from '../schemas/models/product.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductSchema = z.ZodType<z.output<typeof ProductSchema>>;

export interface ProductFactory<TProductSchema extends AnyProductSchema = AnyProductSchema> {
  productSchema: TProductSchema;
  parseProduct(context: RequestContext, data: unknown): z.output<TProductSchema>;
}

export type ProductFactoryOutput<TFactory extends ProductFactory> = ReturnType<
  TFactory['parseProduct']
>;

export type ProductFactoryWithOutput<TFactory extends ProductFactory> = Omit<
  TFactory,
  'parseProduct'
> & {
  parseProduct(context: RequestContext, data: unknown): ProductFactoryOutput<TFactory>;
};
