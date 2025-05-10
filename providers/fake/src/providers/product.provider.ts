import { Product, ProductProvider, ProductQuery } from "@reactionary/core";
import z from "zod";
import { FakeConfig } from "../core/configuration";

export class FakeProductProvider<Q extends Product> extends ProductProvider<Q> {
    protected config: FakeConfig;
  
    constructor(config: FakeConfig, schema: z.ZodType<Q>) {
      super(schema);
  
      this.config = config;
    }
  
    public async get(query: ProductQuery) {
        return undefined as any;
    }
}