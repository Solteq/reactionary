import {
  type InventoryQueryBySKU,
  type RequestContext,
  type Cache,
  InventoryCapability,
  InventorySchema,
  InventoryQueryBySKUSchema,
  Reactionary,
  type InventoryFactory,
  type InventoryFactoryOutput,
  type InventoryFactoryWithOutput,
  type InventoryStatus,
  type NotFoundError,
  type Result,
  success,
} from '@reactionary/core';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import {
  getInventorySource,
  getSourceItems,
  getStockItem,
  getStockStatus,
} from '../core/inventory.api.js';
import {
  resolveMagentoInventoryStatus,
  type MagentoInventoryFactory,
} from '../factories/inventory/inventory.factory.js';
import type { MagentoSourceItem } from '../schema/magento.types.js';
import {
  handleMagentoProviderError,
  isMagentoNotFoundError,
} from '../utils/magento-errors.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:inventory');

/** The source code Magento MSI provisions for single-source stores. */
const DEFAULT_SOURCE_CODE = 'default';

/**
 * Fulfilment centres map onto Magento MSI sources by `source_code`. The
 * default source (and an empty key) also works on stores without MSI, via
 * the legacy `/V1/stockStatuses` endpoint.
 */
export class MagentoInventoryCapability<
  TFactory extends InventoryFactory = MagentoInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: InventoryFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: InventoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /** The MSI source code that the legacy single-stock data represents. */
  protected getDefaultSourceCode(): string {
    return DEFAULT_SOURCE_CODE;
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(
    payload: InventoryQueryBySKU,
  ): Promise<Result<InventoryFactoryOutput<TFactory>, NotFoundError>> {
    const sku = payload.variant.sku;
    const defaultSource = this.getDefaultSourceCode();
    const sourceCode = payload.fulfilmentCenter?.key || defaultSource;
    const identifier = {
      variant: { sku },
      fulfillmentCenter: { key: sourceCode },
    };

    try {
      const sourceItem = await this.findSourceItem(
        sku,
        sourceCode,
        sourceCode === defaultSource,
      );

      if (sourceItem) {
        const quantity = sourceItem.quantity ?? 0;
        const isInStock = sourceItem.status === 1;
        const status =
          isInStock && quantity <= 0
            ? await this.resolveStatusFromStockItem(sku, quantity)
            : resolveMagentoInventoryStatus({ isInStock, quantity });
        return success(
          this.factory.parseInventory(this.context, {
            sku,
            fulfillmentCenterKey: sourceCode,
            quantity,
            status,
          }),
        );
      }

      if (sourceCode !== defaultSource) {
        // Not a source Magento knows → NotFound (thrown as a 404). A known
        // source without this SKU assigned simply holds none of it.
        await getInventorySource(this.magentoApi, sourceCode);
        return success(
          this.factory.parseInventory(this.context, {
            sku,
            fulfillmentCenterKey: sourceCode,
            quantity: 0,
            status: 'outOfStock',
          }),
        );
      }

      const stockStatus = await getStockStatus(this.magentoApi, sku);
      const stockItem = stockStatus.stock_item;
      const quantity = stockStatus.qty ?? stockItem?.qty ?? 0;
      return success(
        this.factory.parseInventory(this.context, {
          sku,
          fulfillmentCenterKey: sourceCode,
          quantity,
          status: resolveMagentoInventoryStatus({
            isInStock: stockStatus.stock_status === 1,
            quantity,
            backorders: stockItem?.backorders,
            manageStock: stockItem?.manage_stock,
          }),
        }),
      );
    } catch (err) {
      return handleMagentoProviderError('load inventory', err, identifier);
    }
  }

  /**
   * The MSI source item of `sku` at `sourceCode`, or undefined when there is
   * none. On stores without MSI (the endpoint 404s) the default source falls
   * back to legacy stock, while any other source cannot exist.
   */
  protected async findSourceItem(
    sku: string,
    sourceCode: string,
    isDefaultSource: boolean,
  ): Promise<MagentoSourceItem | undefined> {
    try {
      const result = await getSourceItems(this.magentoApi, sku, sourceCode);
      return (result.items ?? []).find(
        (item) => item.sku === sku && item.source_code === sourceCode,
      );
    } catch (err) {
      if (isDefaultSource && isMagentoNotFoundError(err)) {
        debug('MSI source items unavailable, using legacy stock for %s', sku);
        return undefined;
      }
      throw err;
    }
  }

  /**
   * An MSI source item carries no backorder setting; that lives on the
   * product's (legacy) stock item, which is consulted when an in-stock source
   * item has nothing on hand.
   */
  protected async resolveStatusFromStockItem(
    sku: string,
    quantity: number,
  ): Promise<InventoryStatus> {
    const stockItem = await getStockItem(this.magentoApi, sku);
    return resolveMagentoInventoryStatus({
      isInStock: true,
      quantity,
      backorders: stockItem.backorders,
      manageStock: stockItem.manage_stock,
    });
  }
}
