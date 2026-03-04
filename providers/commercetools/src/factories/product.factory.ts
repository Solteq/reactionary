import { type Product } from '@reactionary/core';
import type * as z from 'zod';

export class ProductFactory<TProduct extends Product = Product> {
  public readonly schema: z.ZodType<TProduct>;

  public constructor(schema: z.ZodType<TProduct>) {
    this.schema = schema;
  }

  public parseProduct(data: unknown): TProduct {
    return this.schema.parse({
      brand: '',
      description: '',
      identifier: {
        key: '',
      },
      longDescription: '',
      mainVariant: {
        barcode: '',
        ean: '',
        gtin: '',
        identifier: {
          sku: '',
        },
        images: [],
        name: '',
        options: [],
        upc: '',
      },
      manufacturer: '',
      name: '',
      options: [],
      parentCategories: [],
      published: true,
      sharedAttributes: [],
      slug: '',
      variants: [],
    });
  }
}
