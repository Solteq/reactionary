import { ProductIdentifier } from "../schemas/identifiers.schema";
import { ProductSchema } from "../schemas/product.schema";

export abstract class ProductProvider<T> {
    public abstract get(identifier: ProductIdentifier): Promise<T>;
    protected schema() {
        return ProductSchema;
    }
}