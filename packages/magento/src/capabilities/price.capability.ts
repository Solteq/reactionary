import {
  CurrencySchema,
  PriceCapability,
  PriceSchema,
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  Reactionary,
  error,
  success,
  type Cache,
  type Currency,
  type CustomerPriceQuery,
  type InvalidInputError,
  type ListPriceQuery,
  type PriceFactory,
  type PriceFactoryOutput,
  type PriceFactoryWithOutput,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import { isMagentoApiError } from '../core/errors.js';
import { getCompanyOfCustomer, getStoreBaseCurrencyCode } from '../core/price.api.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCustomerData } from '../schema/magento.types.js';
import {
  MAGENTO_NOT_LOGGED_IN_GROUP_ID,
  type MagentoPriceFactory,
} from '../factories/price/price.factory.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:price');

/** `extension_attributes.company_attributes` of an Adobe Commerce B2B customer. */
const CustomerCompanyAttributesSchema = z.looseObject({
  company_attributes: z
    .looseObject({ company_id: z.number().nullish() })
    .nullish(),
});

/**
 * Prices are read from the catalog REST product (admin token): the regular
 * price, the special price with its date range, and the tier prices of the
 * shopper's customer group. Customer group resolution:
 * - anonymous shoppers → NOT LOGGED IN (0);
 * - signed-in customers → their own `group_id`. For Adobe Commerce B2B
 *   company users this is the company's customer group, so shared-catalog
 *   prices (stored by Magento as that group's tier prices) apply.
 *
 * Amounts are in the store's base currency (`config.defaultCurrency`, else
 * the GraphQL `storeConfig.base_currency_code`). Catalog price rules are not
 * exposed by the REST catalog and are not reflected.
 */
export class MagentoPriceCapability<
  TFactory extends PriceFactory = MagentoPriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: PriceFactoryWithOutput<TFactory>;
  private storeCurrency: Promise<Currency> | undefined;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: PriceFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(
    payload: ListPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;
    try {
      const product = await this.magentoApi.getProductBySKU(sku);
      const currency = await this.getStoreCurrency();

      return success(
        this.factory.parsePrice(this.context, {
          product,
          sku,
          mode: 'list',
          customerGroupId: MAGENTO_NOT_LOGGED_IN_GROUP_ID,
          currency,
        }),
      );
    } catch (e) {
      return handleMagentoProviderError('load the list price', e, payload.variant);
    }
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;
    try {
      const customer = await this.getSignedInCustomer();

      if (payload.company) {
        const companyError = await this.verifyCompanyMembership(
          customer,
          payload.company.taxIdentifier,
        );
        if (companyError) {
          return error<InvalidInputError>(companyError);
        }
      }

      const product = await this.magentoApi.getProductBySKU(sku);
      const currency = await this.getStoreCurrency();
      const customerGroupId = customer?.group_id ?? MAGENTO_NOT_LOGGED_IN_GROUP_ID;
      debug('Pricing %s for customer group %d', sku, customerGroupId);

      return success(
        this.factory.parsePrice(this.context, {
          product,
          sku,
          mode: 'customer',
          customerGroupId,
          currency,
        }),
      );
    } catch (e) {
      return handleMagentoProviderError('load the customer price', e, payload.variant);
    }
  }

  /**
   * The signed-in customer, or undefined for guests and for a customer token
   * Magento no longer accepts.
   */
  protected async getSignedInCustomer(): Promise<MagentoCustomerData | undefined> {
    const token = await this.magentoApi.getCustomerToken();
    if (!token) {
      return undefined;
    }
    try {
      return await this.magentoApi.getMe();
    } catch (err) {
      if (isMagentoApiError(err) && (err.status === 401 || err.status === 403)) {
        return undefined;
      }
      throw err;
    }
  }

  /**
   * Company pricing is the company's customer group, which Magento already
   * assigns to its members; the requested company must therefore be the
   * signed-in customer's own (matched on the company's VAT/tax id).
   */
  protected async verifyCompanyMembership(
    customer: MagentoCustomerData | undefined,
    taxIdentifier: string,
  ): Promise<InvalidInputError | undefined> {
    if (!customer) {
      return {
        type: 'InvalidInput',
        error: 'Company pricing requires a signed-in company user.',
      };
    }

    const attributes = CustomerCompanyAttributesSchema.safeParse(
      customer.extension_attributes ?? {},
    );
    const companyId = attributes.success
      ? attributes.data.company_attributes?.company_id
      : undefined;
    if (!companyId) {
      return {
        type: 'InvalidInput',
        error: 'The signed-in customer does not belong to a company.',
      };
    }

    const company = await getCompanyOfCustomer(this.magentoApi, companyId);
    const vat = company.vat_tax_id?.trim();
    if (vat && vat.toLowerCase() !== taxIdentifier.trim().toLowerCase()) {
      return {
        type: 'InvalidInput',
        error: 'The requested company is not the signed-in customer\'s company.',
      };
    }
    return undefined;
  }

  /** The currency catalog prices are kept in. */
  protected getStoreCurrency(): Promise<Currency> {
    if (!this.storeCurrency) {
      this.storeCurrency = this.loadStoreCurrency().catch((err: unknown) => {
        this.storeCurrency = undefined;
        throw err;
      });
    }
    return this.storeCurrency;
  }

  private async loadStoreCurrency(): Promise<Currency> {
    const configured = CurrencySchema.safeParse(this.config.defaultCurrency);
    if (configured.success) {
      return configured.data;
    }

    const fromStore = CurrencySchema.safeParse(
      await getStoreBaseCurrencyCode(this.magentoApi),
    );
    if (fromStore.success) {
      return fromStore.data;
    }

    debug('No store currency found, using the request currency');
    return this.context.languageContext.currencyCode;
  }
}
