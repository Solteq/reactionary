import type * as z from 'zod';
import type { StoreSchema } from '../schemas/models/store.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyStoreSchema = z.ZodType<z.output<typeof StoreSchema>>;

export interface StoreFactory<TStoreSchema extends AnyStoreSchema = AnyStoreSchema> {
  storeSchema: TStoreSchema;
  parseStore(context: RequestContext, data: unknown): z.output<TStoreSchema>;
}

export type StoreFactoryOutput<TFactory extends StoreFactory> = ReturnType<
  TFactory['parseStore']
>;

export type StoreFactoryWithOutput<TFactory extends StoreFactory> = Omit<
  TFactory,
  'parseStore'
> & {
  parseStore(context: RequestContext, data: unknown): StoreFactoryOutput<TFactory>;
};
