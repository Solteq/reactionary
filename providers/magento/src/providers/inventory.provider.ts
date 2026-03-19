import {
    type Inventory,
    type InventoryQueryBySKU,
    type RequestContext,
    type Cache,
    InventoryProvider,
    InventorySchema,
    InventoryQueryBySKUSchema,
    Reactionary,
    type InventoryIdentifier,
    type NotFoundError,
    type Result,
    success,
} from '@reactionary/core';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:inventory');

export class MagentoInventoryProvider extends InventoryProvider {
    protected config: MagentoConfiguration;

    constructor(
        config: MagentoConfiguration,
        cache: Cache,
        context: RequestContext,
        public magentoApi: MagentoClient
    ) {
        super(cache, context);
        this.config = config;
    }

    @Reactionary({
        inputSchema: InventoryQueryBySKUSchema,
        outputSchema: InventorySchema,
    })
    public override async getBySKU(payload: InventoryQueryBySKU): Promise<Result<Inventory, NotFoundError>> {
        const sku = payload.variant.sku;
        const fulfillmentCenterKey = payload.fulfilmentCenter?.key;
        const client = await this.magentoApi.getClient();

        try {
            if (fulfillmentCenterKey) {
                // Try MSI Source Items
                const params = new URLSearchParams();
                params.set('searchCriteria[filterGroups][0][filters][0][field]', 'sku');
                params.set('searchCriteria[filterGroups][0][filters][0][value]', sku);
                params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');

                params.set('searchCriteria[filterGroups][1][filters][0][field]', 'source_code');
                params.set('searchCriteria[filterGroups][1][filters][0][value]', fulfillmentCenterKey);
                params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');

                const msiResponse = await client.store.inventory.getSourceItems(params);
                if (msiResponse?.items?.length > 0) {
                    const item = msiResponse.items[0];
                    return success(this.parseSingle({
                        sku,
                        fulfillmentCenterKey,
                        quantity: item.quantity,
                        status: item.status === 1 ? 'inStock' : 'outOfStock'
                    }));
                }
            }

            const statusResponse = await client.store.inventory.getStockStatus(sku);
            return success(this.parseSingle({
                sku,
                fulfillmentCenterKey: fulfillmentCenterKey || 'default',
                quantity: statusResponse.qty || 0,
                status: statusResponse.stock_status === 1 ? 'inStock' : 'outOfStock'
            }));

        } catch (e: any) {
            debug('Error fetching inventory', e);
            return success(this.createEmptyInventory({
                variant: { sku },
                fulfillmentCenter: { key: fulfillmentCenterKey || 'default' }
            }));
        }
    }

    protected parseSingle(body: any): Inventory {
        const identifier = {
            variant: { sku: body.sku },
            fulfillmentCenter: { key: body.fulfillmentCenterKey },
        } satisfies InventoryIdentifier;

        return {
            identifier,
            quantity: body.quantity,
            status: body.status,
        } satisfies Inventory;
    }
}
