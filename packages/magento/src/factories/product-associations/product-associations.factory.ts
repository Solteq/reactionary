import {
  type AnyProductAssociationSchema,
  type ProductAssociation,
  type ProductAssociationSchema,
  type ProductAssociationsFactory,
  type ProductAssociationsIdentifier,
  type ProductSearchResultItem,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoProduct } from '../../schema/magento.types.js';
import { buildProductSearchResultItem } from '../../utils/magento-product.js';

export interface MagentoProductAssociationFactoryInput {
  product: MagentoProduct;
  identifier: ProductAssociationsIdentifier;
}

export class MagentoProductAssociationsFactory<
  TProductAssociationSchema extends
    AnyProductAssociationSchema = typeof ProductAssociationSchema,
> implements ProductAssociationsFactory<TProductAssociationSchema>
{
  public readonly productAssociationSchema: TProductAssociationSchema;
  protected readonly config: MagentoConfiguration;

  constructor(
    productAssociationSchema: TProductAssociationSchema,
    config: MagentoConfiguration,
  ) {
    this.productAssociationSchema = productAssociationSchema;
    this.config = config;
  }

  protected parseProduct(
    _context: RequestContext,
    product: MagentoProduct,
  ): ProductSearchResultItem {
    return buildProductSearchResultItem(this.config, product);
  }

  public parseAssociation(
    context: RequestContext,
    data: MagentoProductAssociationFactoryInput,
  ): z.output<TProductAssociationSchema> {
    const result = {
      associationIdentifier: data.identifier,
      associationReturnType: 'productSearchResultItem',
      product: this.parseProduct(context, data.product),
    } satisfies ProductAssociation;

    return this.productAssociationSchema.parse(result);
  }
}
