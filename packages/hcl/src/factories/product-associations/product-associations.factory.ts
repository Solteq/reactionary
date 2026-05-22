import type {
  AnyProductAssociationSchema,
  ProductAssociationSchema,
  ProductAssociationsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclAssociation } from '../../schema/hcl.schema.js';

export class HclProductAssociationsFactory<
  TProductAssociationSchema extends
    AnyProductAssociationSchema = typeof ProductAssociationSchema,
> implements ProductAssociationsFactory<TProductAssociationSchema>
{
  public readonly productAssociationSchema: TProductAssociationSchema;

  constructor(productAssociationSchema: TProductAssociationSchema) {
    this.productAssociationSchema = productAssociationSchema;
  }

  public parseAssociation(
    _context: RequestContext,
    data: HclAssociation,
  ): z.output<TProductAssociationSchema> {
    return this.productAssociationSchema.parse({
      associationIdentifier: { key: data.partNumber },
      associationReturnType: 'idOnly',
      product: { key: data.partNumber },
    });
  }
}
