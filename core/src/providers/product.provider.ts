import { z } from 'zod';
import { Product, ProductQuery } from '../schemas/product.schema';

export abstract class ProductProvider<T = Product> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  public abstract parse(data: unknown, query: ProductQuery): T;
  public abstract get(query: ProductQuery): Promise<T>;
}
