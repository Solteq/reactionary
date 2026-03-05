import type {
  AnyProductAssociationSchema,
  ProductAssociationSchema,
  ProductAssociationsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaProductAssociationsFactory<
  TProductAssociationSchema extends AnyProductAssociationSchema = typeof ProductAssociationSchema,
> implements ProductAssociationsFactory<TProductAssociationSchema>
{
  public readonly productAssociationSchema: TProductAssociationSchema;

  constructor(productAssociationSchema: TProductAssociationSchema) {
    this.productAssociationSchema = productAssociationSchema;
  }

  public parseAssociation(
    _context: RequestContext,
    data: unknown,
  ): z.output<TProductAssociationSchema> {
    return this.productAssociationSchema.parse(data);
  }
}
