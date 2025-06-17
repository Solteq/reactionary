import { BaseMutation, Product, ProductProvider, ProductQuery, Session } from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { z } from 'zod';
import { AlgoliaConfiguration } from '../schema/configuration.schema';

export class AlgoliaProductProvider<
  T extends Product
> extends ProductProvider<T> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>) {
    super(schema);

    this.config = config;
  }

  public async query(query: ProductQuery, session: Session) {
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const remote = await client.search({
      requests: [
        {
          indexName: this.config.indexName,
          filters: `objectID:${query.id} OR slug:${query.slug}`,
        },
      ],
    });

    const p = (remote.results[0] as any).hits[0];
    const parsed = this.parse(p);
    const validated = this.validate(parsed);

    return validated;
  }

    public override mutate(mutation: BaseMutation, session: Session): Promise<T> {
      throw new Error("Method not implemented.");
    }

  public override parse(data: any): T {
    const base = this.base();

    base.identifier = {
      key: data.objectID,
    };
    base.name = data.name;
    base.image = data.image;
    base.description = '';
    base.slug = '';
    base.images = [];
    base.attributes = [];

    return base;
  }
}
