import type {
  AnyIdentitySchema,
  IdentityFactory,
  IdentitySchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeIdentityFactory<
  TIdentitySchema extends AnyIdentitySchema = typeof IdentitySchema,
> implements IdentityFactory<TIdentitySchema>
{
  public readonly identitySchema: TIdentitySchema;

  constructor(identitySchema: TIdentitySchema) {
    this.identitySchema = identitySchema;
  }

  public parseIdentity(
    _context: RequestContext,
    data: unknown,
  ): z.output<TIdentitySchema> {
    return this.identitySchema.parse(data);
  }
}
