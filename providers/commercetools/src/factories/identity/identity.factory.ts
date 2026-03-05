import {
  IdentitySchema,
  type AnyIdentitySchema,
  type IdentityFactory,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsIdentityFactory<
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
