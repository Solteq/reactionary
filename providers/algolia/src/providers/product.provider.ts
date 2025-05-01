import { Product, ProductProvider, ProductQuery } from '@reactionary/core';
import { algoliasearch } from 'algoliasearch';
import { AlgoliaConfig } from '../core/configuration';
import { z } from 'zod';

export class AlgoliaProductProvider<T extends z.ZodTypeAny> extends ProductProvider<T> {
  protected config: AlgoliaConfig;

  constructor(config: AlgoliaConfig, schema: T) {
    super(schema);

    this.config = config;
  }

  public async get(query: ProductQuery) {
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
    const parsed = this.parse(p);

    return this.validate(parsed);
  }

  public override parse(data: any): z.infer<T> {
    const id = {
      id: data.objectID
    };

    const result: Product = {
      identifier: id,
      name: data.name,
      image: data.image,
      description: 'test',
      status: 'Active',
      slug: '',
      images: [],
      attributes: []
    };

    return result;
  }  
}

