import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfile,
  PersonalizationProfileFactory,
  PersonalizationProfileIdentifier,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type { Customer } from '@commercetools/platform-sdk';
import type * as z from 'zod';

export class CommercetoolsPersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema>
{
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: Customer,
  ): z.output<TPersonalizationProfileSchema> {
    const segments = (data.customerGroupAssignments ?? [])
      .map((assignment) => assignment.customerGroup.obj?.key)
      .filter((key): key is string => key != null);

    const result = {
      identifier: { key: data.id } satisfies PersonalizationProfileIdentifier,
      segments,
      blurb: '',
    } satisfies PersonalizationProfile

    return this.personalizationProfileSchema.parse(result);
  }
}
