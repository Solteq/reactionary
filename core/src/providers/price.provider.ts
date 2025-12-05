import type { Price, Result } from '../schemas/index.js';
import type {
  CustomerPriceQuery,
  ListPriceQuery,
} from '../schemas/queries/price.query.js';
import { BaseProvider } from './base.provider.js';

export abstract class PriceProvider extends BaseProvider {
  /**
   * Get a list price price by SKU. This is the most general, undiscounted price and is typically
   * used as the "before" price in most ecommerce setups.
   *
   * Usecase: You are rendering a product page, and you need to show the price for a SKU.
   * @param payload The SKU to query
   * @param session The session information
   */
  public abstract getListPrice(payload: ListPriceQuery): Promise<Result<Price>>;

  /**
   * Get a customer-specific price by SKU.
   *
   * No
   *
   * Usecase: You are rendering a product page, and you need to show the price for a SKU.
   * @param payload The SKU to query
   * @param session The session information
   */
  public abstract getCustomerPrice(payload: CustomerPriceQuery): Promise<Result<Price>>;

  /**
   * Utility function to create an empty price result, with a value of -1.
   * This is used when no price is found for a given SKU + currency combination.
   * You should check for meta.placeholder to see if this is a real price or a placeholder.
   * @param sku
   * @param currency
   * @returns
   */
  protected createEmptyPriceResult(sku: string): Price {
    const price = {
      identifier: {
        variant: {
          sku,
        },
      },
      tieredPrices: [],
      unitPrice: {
        value: -1,
        currency: this.context.languageContext.currencyCode,
      },
      meta: {
        cache: {
          hit: false,
          key: `price-${sku}-${this.context.languageContext.currencyCode}`,
        },
        placeholder: true,
      },
    } satisfies Price;

    return price;
  }

  protected override getResourceName(): string {
    return 'price';
  }
}
