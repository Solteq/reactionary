import type {
  AnyProfileSchema,
  ProfileFactory,
  ProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;

  constructor(profileSchema: TProfileSchema) {
    this.profileSchema = profileSchema;
  }

  public parseProfile(_context: RequestContext, data: unknown): z.output<TProfileSchema> {
    return this.profileSchema.parse(data);
  }
}
