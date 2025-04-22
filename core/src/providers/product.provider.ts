import { ProductIdentifier } from "../schemas/identifiers.schema";
import { Product, ProductSchema } from "../schemas/product.schema";

export abstract class ProductProvider<T = Product> {
    public abstract get(identifier: ProductIdentifier): Promise<T>;
    public schema() {
        return ProductSchema;
    }
}