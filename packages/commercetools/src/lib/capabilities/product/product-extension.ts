import type {
  ProcedureContext,
  Product,
  ProductSchema,
} from '@reactionary/core';
import type { ProductProjection as CTProductProjection } from '@commercetools/platform-sdk';
import type * as z from 'zod';

export type CommercetoolsProductTransformContext = {
  product: Product;
  rawProduct: CTProductProjection;
  context: ProcedureContext;
};

export type CommercetoolsProductExtension<
  ProductOutputSchema extends z.ZodTypeAny = typeof ProductSchema,
> = {
  schema: ProductOutputSchema;
  transform?: (
    input: CommercetoolsProductTransformContext
  ) => z.infer<ProductOutputSchema> | Promise<z.infer<ProductOutputSchema>>;
};
