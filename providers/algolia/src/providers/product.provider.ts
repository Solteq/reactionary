import { 
  Product, 
  ProductProvider, 
  ProductQueryById, 
  ProductQueryBySlug, 
  Session,
  Cache 
} from '@reactionary/core';
import { z } from 'zod';
import { AlgoliaConfiguration } from '../schema/configuration.schema';

export class AlgoliaProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async getById(
    payload: ProductQueryById,
    _session: Session
  ): Promise<T> {
    // TODO: Implement Algolia product fetch by ID
    const result = this.newModel();
    result.identifier = { key: payload.id };
    result.name = `Algolia Product ${payload.id}`;
    result.slug = payload.id;
    result.description = 'Product from Algolia';
    result.meta = {
      cache: { hit: false, key: payload.id },
      placeholder: true
    };
    
    return this.assert(result);
  }

  public override async getBySlug(
    payload: ProductQueryBySlug,
    _session: Session
  ): Promise<T> {
    // TODO: Implement Algolia product fetch by slug
    const result = this.newModel();
    result.identifier = { key: payload.slug };
    result.name = `Algolia Product ${payload.slug}`;
    result.slug = payload.slug;
    result.description = 'Product from Algolia';
    result.meta = {
      cache: { hit: false, key: payload.slug },
      placeholder: true
    };
    
    return this.assert(result);
  }
}
