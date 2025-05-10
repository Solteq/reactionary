import { z } from 'zod';
import { ProductQuery } from '../schemas/product.schema';

export abstract class ProductProvider<T> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  public parse(data: unknown): T {
    return data as T;
  }
  
  public abstract get(query: ProductQuery): Promise<T>;
}
