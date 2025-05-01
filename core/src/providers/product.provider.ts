import { z } from 'zod';
import { ProductQuery, ProductSchema } from '../schemas/product.schema';

export abstract class ProductProvider<T extends z.ZodType> {
    protected schema: typeof ProductSchema = ProductSchema;

    protected validate(value: unknown): z.infer<T> {
      return this.schema.parse(value);
    }

    public abstract parse(data: unknown) : z.infer<T>;
    public abstract get(query: ProductQuery): Promise<z.infer<T>>;
}

