import type {
  Cache,
  NotFoundError,
  OrderFactory,
  OrderFactoryOutput,
  OrderFactoryWithOutput,
  OrderQueryById,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  OrderCapability,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import { fetchMagentoOrderCompany, wasMagentoOrderPlacedInSession } from '../core/order.api.js';
import type { MagentoOrderFactory } from '../factories/order/order.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoSalesOrder } from '../schema/magento.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:order');

/** Magento order entity ids are positive integers. */
const ORDER_ENTITY_ID = /^[1-9]\d*$/;

export class MagentoOrderCapability<
  TFactory extends OrderFactory = MagentoOrderFactory,
> extends OrderCapability<OrderFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: OrderFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * Orders are read with the admin token and their entity ids are sequential,
   * so access is checked here: the signed-in customer must own the order, or
   * the order must have been placed in this session (a guest's confirmation
   * page). Anything else is reported as NotFound, so the existence of other
   * customers' orders is not disclosed.
   */
  protected canAccessOrder(
    order: MagentoSalesOrder,
    customerId: number | null,
    placedInSession: boolean,
  ): boolean {
    if (placedInSession) {
      return true;
    }
    const isGuestOrder = order.customer_is_guest === 1 || !order.customer_id;
    return customerId !== null && !isGuestOrder && Number(order.customer_id) === customerId;
  }

  /**
   * Attaches the B2B company's tax id, which core identifies companies by but
   * the order does not carry. The company id comes from the (owned) order.
   * Best effort: an order stays readable when the company cannot be read.
   */
  protected async withCompanyTaxId(order: MagentoSalesOrder): Promise<MagentoSalesOrder> {
    const extension = order.extension_attributes;
    const companyAttributes = extension?.['company_order_attributes'];
    if (
      typeof companyAttributes !== 'object' ||
      companyAttributes === null ||
      !('company_id' in companyAttributes)
    ) {
      return order;
    }
    const companyId = Number(companyAttributes.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return order;
    }
    try {
      const company = await fetchMagentoOrderCompany(this.magentoApi, companyId);
      if (!company.vat_tax_id) {
        return order;
      }
      return {
        ...order,
        extension_attributes: {
          ...extension,
          company_order_attributes: { ...companyAttributes, vat_tax_id: company.vat_tax_id },
        },
      };
    } catch (err) {
      debug('getById: company %d not readable, order returned without its VAT id: %O', companyId, err);
      return order;
    }
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public async getById(
    payload: OrderQueryById,
  ): Promise<Result<OrderFactoryOutput<TFactory>, NotFoundError>> {
    debug('getById %s', payload.order.key);
    const notFound = error<NotFoundError>({
      type: 'NotFound',
      identifier: payload.order,
    });

    if (!ORDER_ENTITY_ID.test(payload.order.key)) {
      return notFound;
    }

    try {
      const customerId = await this.magentoApi.getCustomerId();
      const placedInSession = await wasMagentoOrderPlacedInSession(
        this.magentoApi,
        payload.order.key,
      );
      // Nothing a guest can be entitled to: skip the admin read altogether.
      if (customerId === null && !placedInSession) {
        return notFound;
      }
      const data = await this.magentoApi.getOrderById(payload.order.key);
      if (!data || !this.canAccessOrder(data, customerId, placedInSession)) {
        return notFound;
      }
      const order = await this.withCompanyTaxId(data);
      return success(this.factory.parseOrder(this.context, order));
    } catch (err) {
      return handleMagentoProviderError('get order', err, payload.order);
    }
  }
}
