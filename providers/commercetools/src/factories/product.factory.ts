import { ProductSchema } from "@reactionary/core";
import type * as z from "zod";

export class ProductFactory {
    public readonly schema = ProductSchema;

    public parseProduct(data: any): z.infer<this["schema"]> {
        return {

        } as any;
    }
}
