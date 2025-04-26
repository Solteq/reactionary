import { z } from 'zod';
import { ProductQuery } from '../schemas/product.schema';

export abstract class ProductProvider<T extends z.ZodTypeAny> {
    protected schema: T;

    constructor(schema: T) {
      this.schema = schema;
    }

    public parse(value: unknown): z.infer<T> {
      return this.schema.parse(value);
    }

    public abstract get(query: ProductQuery): Promise<z.infer<T>>;
}

