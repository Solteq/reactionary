import {
  ProductAssociationsCapability,
  ProductAssociationSchema,
  ProductAssociationsGetAccessoriesQuerySchema,
  ProductAssociationsGetSparepartsQuerySchema,
  ProductAssociationsGetReplacementsQuerySchema,
  Reactionary,
  success,
  type Cache,
  type ProductAssociationsFactory,
  type ProductAssociationsFactoryOutput,
  type ProductAssociationsFactoryWithOutput,
  type ProductAssociationsGetAccessoriesQuery,
  type ProductAssociationsGetReplacementsQuery,
  type ProductAssociationsGetSparepartsQuery,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type {
  HclAssociation,
  HclProductQueryResponse,
} from '../schema/hcl.schema.js';
import type { HclProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import * as z from 'zod';

export class HclProductAssociationsCapability<
  TFactory extends ProductAssociationsFactory = HclProductAssociationsFactory,
> extends ProductAssociationsCapability<
  ProductAssociationsFactoryOutput<TFactory>
> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductAssociationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetAccessoriesQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
  })
  public override async getAccessories(
    query: ProductAssociationsGetAccessoriesQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associations = await this.fetchAssociations(
      query.forProduct.key,
      this.config.associationTypes.accessories,
      query.numberOfAccessories,
    );
    return success(
      associations.map((a) => this.factory.parseAssociation(this.context, a)),
    );
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetSparepartsQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
  })
  public override async getSpareparts(
    query: ProductAssociationsGetSparepartsQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associations = await this.fetchAssociations(
      query.forProduct.key,
      this.config.associationTypes.spareparts,
      query.numberOfSpareparts,
    );
    return success(
      associations.map((a) => this.factory.parseAssociation(this.context, a)),
    );
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetReplacementsQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
  })
  public override async getReplacements(
    query: ProductAssociationsGetReplacementsQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associations = await this.fetchAssociations(
      query.forProduct.key,
      this.config.associationTypes.replacements,
      query.numberOfReplacements,
    );
    return success(
      associations.map((a) => this.factory.parseAssociation(this.context, a)),
    );
  }

  /**
   * Fetches the product detail for the given part number and returns the
   * `merchandisingAssociations` filtered to the requested association types,
   * capped at `maxCount`.
   */
  protected async fetchAssociations(
    partNumber: string,
    types: string[],
    maxCount: number,
  ): Promise<HclAssociation[]> {
    const response = await this.client.callGet<HclProductQueryResponse>(
      this.getProductsUrl(),
      this.getProductsParams(partNumber),
    );

    const product = (response.contents ?? response.catalogEntryView ?? [])[0];
    if (!product?.merchandisingAssociations) {
      return [];
    }

    return product.merchandisingAssociations
      .filter(
        (a) => a.associationCodeType && types.includes(a.associationCodeType),
      )
      .slice(0, maxCount);
  }

  protected getProductsUrl(): string {
    return `${this.client.catalogBaseUrl}/api/v2/products`;
  }

  protected getProductsParams(partNumber: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('partNumber', partNumber);
    params.set('profileName', this.config.profiles.product);
    return params;
  }
}
