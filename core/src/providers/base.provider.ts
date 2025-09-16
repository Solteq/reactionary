import { z } from 'zod';
import { BaseModel, createPaginatedResponseSchema } from '../schemas/models/base.model';
import { Cache } from '../cache/cache.interface';
import { Session } from '../schemas/session.schema';
import { IdentifierType } from '../schemas/models/identifiers.model';

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
  protected parseSingle(_body: unknown, session: Session): T {
    const model = this.newModel();

    return this.assert(model);
  }


  protected parsePaginatedResult(_body: unknown, session: Session): z.infer<ReturnType<typeof createPaginatedResponseSchema<typeof this.schema>>> {
    return createPaginatedResponseSchema(this.schema).parse({});
  }

  protected generateCacheKeyPaginatedResult(resultSetName: string, res:  ReturnType<typeof this.parsePaginatedResult>, session: Session): string {
    const type = this.getResourceName();
    const langPart = session.languageContext.locale;
    const currencyPart = session.languageContext.currencyCode || 'default';
    const storePart = session.storeIdentifier?.key || 'default';
    return `${type}-${resultSetName}-paginated|pageNumber:${res.pageNumber}|pageSize:${res.pageSize}|store:${storePart}|lang:${langPart}|currency:${currencyPart}`;
  }


  protected generateCacheKeySingle(identifier: IdentifierType, session: Session): string {
    const type = this.getResourceName();
    const idPart = Object.entries(identifier).map(([k, v]) => `${k}:${(v as any).key}`).join('#');
    const langPart = session.languageContext.locale;
    const currencyPart = session.languageContext.currencyCode || 'default';
    const storePart = session.storeIdentifier?.key || 'default';
    return `${type}-${idPart}|store:${storePart}|lang:${langPart}|currency:${currencyPart}`;
  }

  /**
   * Returns the abstract resource name provided by the remote system.
   */
  protected abstract getResourceName(): string ;
}
