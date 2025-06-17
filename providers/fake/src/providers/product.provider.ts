import { BaseMutation, Product, ProductProvider, ProductQuery, Session } from "@reactionary/core";
import z from "zod";
import { FakeConfiguration } from "../schema/configuration.schema";
import { base, en, Faker } from '@faker-js/faker';

export class FakeProductProvider<Q extends Product> extends ProductProvider<Q> {
    protected config: FakeConfiguration;
  
    constructor(config: FakeConfiguration, schema: z.ZodType<Q>) {
      super(schema);
  
      this.config = config;
    }
  
    public async query(query: ProductQuery) {
        return this.parse({}, query);
    }

    public override mutate(mutation: BaseMutation, session: Session): Promise<Q> {
      throw new Error("Method not implemented.");
    }

    public override parse(data: unknown, query: ProductQuery): Q {
      const generator = new Faker({
        seed: 42,
        locale: [en, base],
      });

      const key = query.id as string || generator.commerce.isbn();
      const slug = query.slug as string || generator.lorem.slug();

      const product: Product = {
        identifier: {
          key: key
        },
        name: generator.commerce.productName(),
        slug: slug,
        attributes: [],
        description: generator.commerce.productDescription(),
        image: generator.image.urlPicsumPhotos({
          width: 600,
          height: 600
        }),
        images: [],
        meta: {
          cache: {
            hit: false,
            key: key
          }
        },
        skus: []
      }

      return this.schema.parse(product);
    }
}