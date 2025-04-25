import { Product, ProductIdentifierSchema, ProductProvider, ProductQuery, ProductSchema } from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaConfig } from '../core/configuration';

export class AlgoliaProductProvider<T extends Product> extends ProductProvider<T> {
  protected config: AlgoliaConfig;

  constructor(config: AlgoliaConfig) {
    super();

    this.config = config;
  }

  public override schema() {
    return ProductSchema;
  }

  public async get(query: ProductQuery): Promise<T> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const remote = await client.search({
      requests: [
        {
          indexName: this.config.indexName,
          filters: `objectID:${ query.id } OR slug:${ query.slug }`,
        },
      ],
    });
    
    const p = (remote.results[0] as any).hits[0];

    const id = ProductIdentifierSchema.parse({
        id: p.objectID
    });

    return this.schema().parse({
        identifier: id,
        name: p.name,
        image: p.image
    }) as T;
  }
}
