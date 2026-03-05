import type * as z from 'zod';
import type { IdentitySchema } from '../schemas/models/identity.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyIdentitySchema = z.ZodType<z.output<typeof IdentitySchema>>;

export interface IdentityFactory<
  TIdentitySchema extends AnyIdentitySchema = AnyIdentitySchema,
> {
  identitySchema: TIdentitySchema;
  parseIdentity(context: RequestContext, data: unknown): z.output<TIdentitySchema>;
}

export type IdentityFactoryOutput<TFactory extends IdentityFactory> = ReturnType<
  TFactory['parseIdentity']
>;

export type IdentityFactoryWithOutput<TFactory extends IdentityFactory> = Omit<
  TFactory,
  'parseIdentity'
> & {
  parseIdentity(
    context: RequestContext,
    data: unknown,
  ): IdentityFactoryOutput<TFactory>;
};
