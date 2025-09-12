import { z } from 'zod';
import { BaseModel } from '../schemas/models/base.model';
import { Cache } from '../cache/cache.interface';

/**
 * Base capability provider, responsible for mutations (changes) and queries (fetches)
 * for a given business object domain.
 */
export abstract class BaseProvider<
  T extends BaseModel = BaseModel
> {
  protected cache: Cache;
  
  constructor(
    public readonly schema: z.ZodType<T>,
    cache: Cache
  ) {
    this.cache = cache;
  }

  /**
   * Validates that the final domain model constructed by the provider
   * fulfills the schema as defined. This will throw an exception.
   */
  protected assert(value: T) {
    return this.schema.parse(value);
  }

  /**
   * Creates a new model entity based on the schema defaults.
   */
  protected newModel(): T {
    return this.schema.parse({});
  }

  /**
   * Handler for parsing a response from a remote provider and converting it
   * into the typed domain model.
   */
  protected parseSingle(body: unknown): T {
    const model = this.newModel();

    return this.assert(model);
  }
}
