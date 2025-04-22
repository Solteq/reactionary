import { ProductIdentifier } from "../schemas/identifiers.schema";
import { Product } from "../schemas/product.schema";

export interface ProductProvider {
    get(identifier: ProductIdentifier): Promise<Product>;
}