import { Product, ProductQuery, ProductSchema } from "../schemas/product.schema";

export abstract class ProductProvider<T = Product> {
    public abstract get(query: ProductQuery): Promise<T>;
    public schema() {
        return ProductSchema;
    }
}