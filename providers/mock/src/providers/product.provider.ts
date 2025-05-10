import { Product, ProductProvider, ProductQuery } from "@reactionary/core";
import z from "zod";
import { MockConfig } from "../core/configuration";

export class MockProductProvider<Q extends Product> extends ProductProvider<Q> {
    protected config: MockConfig;
  
    constructor(config: MockConfig, schema: z.ZodType<Q>) {
      super(schema);
  
      this.config = config;
    }
  
    public async get(query: ProductQuery) {
        return undefined as any;
    }
}