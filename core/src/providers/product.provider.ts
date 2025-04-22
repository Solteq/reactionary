import { ProductIdentifier } from "../schemas/identifiers.schema";
import { ProductSchema } from "../schemas/product.schema";
import { z } from 'zod';

export abstract class ProductProvider<T extends typeof ProductSchema = typeof ProductSchema> {
    public abstract get(identifier: ProductIdentifier): Promise<z.infer<T>>;
    protected schema() {
        return ProductSchema;
    }
}