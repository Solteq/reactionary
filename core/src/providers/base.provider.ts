import { z } from 'zod';
import { Session } from '../schemas/session.schema';
import { BaseQuery } from '../schemas/queries/base.query';
import { BaseMutation } from '../schemas/mutations/base.mutation';
import { BaseModel } from '../schemas/models/base.model';
import { createProviderInstrumentation } from '@reactionary/otel';

/**
 * Base capability provider, responsible for mutations (changes) and queries (fetches)
 * for a given business object domain.
 */
export abstract class BaseProvider<
  T extends BaseModel = BaseModel,
  Q extends BaseQuery = BaseQuery,
  M extends BaseMutation = BaseMutation
> {
  private instrumentation: ReturnType<typeof createProviderInstrumentation>;
  
  constructor(public readonly schema: z.ZodType<T>, public readonly querySchema: z.ZodType<Q, Q>, public readonly mutationSchema: z.ZodType<M, M>) {
    this.instrumentation = createProviderInstrumentation(this.constructor.name);
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
   * Retrieves a set of entities matching the list of queries. The size of
   * the resulting list WILL always match the size of the query list. The
   * result list will never contain nulls or undefined. The order
   * of the results will match the order of the queries.
   */
  public async query(queries: Q[], session: Session): Promise<T[]> {
    return this.instrumentation.traceQuery(
      'query',
      async (span) => {
        span.setAttribute('provider.query.count', queries.length);
        const results = await this.fetch(queries, session);

        for (const result of results) {
          this.assert(result);
        }

        span.setAttribute('provider.result.count', results.length);
        return results;
      },
      { queryCount: queries.length }
    );
  }

  /**
   * Executes the listed mutations in order and returns the final state
   * resulting from that set of operations.
   */
  public async mutate(mutations: M[], session: Session): Promise<T> {
    return this.instrumentation.traceMutation(
      'mutate',
      async (span) => {
        span.setAttribute('provider.mutation.count', mutations.length);
        const result = await this.process(mutations, session);

        this.assert(result);

        return result;
      },
      { mutationCount: mutations.length }
    );
  }

  /**
   * The internal extension point for providers implementating query
   * capabilities.
   */
  protected abstract fetch(queries: Q[], session: Session): Promise<T[]>;

  /**
   * The internal extension point for providers implementing mutation
   * capabilities.
   */
  protected abstract process(
    mutations: M[],
    session: Session
  ): Promise<T>;
}
