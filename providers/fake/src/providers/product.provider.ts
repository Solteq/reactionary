import { Product, ProductProvider, ProductQuery } from "@reactionary/core";
import z from "zod";
import { FakeConfiguration } from "../schema/configuration.schema";

export class FakeProductProvider<Q extends Product> extends ProductProvider<Q> {
    protected config: FakeConfiguration;
  
    constructor(config: FakeConfiguration, schema: z.ZodType<Q>) {
      super(schema);
  
      this.config = config;
    }
  
    public async get(query: ProductQuery) {
        return undefined as any;
    }
}