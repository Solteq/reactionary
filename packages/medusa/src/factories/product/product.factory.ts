import type {
  AnyProductSchema,
  ProductFactory,
  ProductSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  constructor(productSchema: TProductSchema) {
    this.productSchema = productSchema;
  }

  public parseProduct(_context: RequestContext, data: unknown): z.output<TProductSchema> {
    return this.productSchema.parse(data);
  }
}
