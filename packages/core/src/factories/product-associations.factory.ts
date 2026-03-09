import type * as z from 'zod';
import type { ProductAssociationSchema } from '../schemas/models/product-associations.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductAssociationSchema = z.ZodType<
  z.output<typeof ProductAssociationSchema>
>;

export interface ProductAssociationsFactory<
  TProductAssociationSchema extends AnyProductAssociationSchema = AnyProductAssociationSchema,
> {
  productAssociationSchema: TProductAssociationSchema;
  parseAssociation(
    context: RequestContext,
    data: unknown,
  ): z.output<TProductAssociationSchema>;
}

export type ProductAssociationsFactoryOutput<
  TFactory extends ProductAssociationsFactory,
> = ReturnType<TFactory['parseAssociation']>;

export type ProductAssociationsFactoryWithOutput<
  TFactory extends ProductAssociationsFactory,
> = Omit<TFactory, 'parseAssociation'> & {
  parseAssociation(
    context: RequestContext,
    data: unknown,
  ): ProductAssociationsFactoryOutput<TFactory>;
};
