import type {
  AnyOrderSchema,
  CostBreakDown,
  Currency,
  IdentityIdentifier,
  ItemCostBreakdown,
  Order,
  OrderFactory,
  OrderInventoryStatus,
  OrderItem,
  OrderSchema,
  OrderStatus,
  PaymentInstruction,
  PaymentMethodIdentifier,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  HclWcsOrderDetailResponse,
  HclWcsOrderItem,
  HclWcsPaymentInstruction,
} from '../../schema/hcl.schema.js';

function mapWcsOrderStatus(status: string): OrderStatus {
  switch (status) {
    case 'S':
      return 'Shipped';
    case 'X':
    case 'R':
    case 'D':
      return 'Cancelled';
    case 'M':
    case 'G':
    case 'F':
      return 'ReleasedToFulfillment';
    default:
      // 'P' (pending), 'I' (initial), 'W' (awaiting approval), 'N' (no inventory), etc.
      return 'AwaitingPayment';
  }
}

export class HclOrderFactory<
  TOrderSchema extends AnyOrderSchema = typeof OrderSchema,
> implements OrderFactory<TOrderSchema>
{
  public readonly orderSchema: TOrderSchema;

  constructor(orderSchema: TOrderSchema) {
    this.orderSchema = orderSchema;
  }

  public parseOrder(
    context: RequestContext,
    data: HclWcsOrderDetailResponse,
  ): z.output<TOrderSchema> {
    const currency = (data.grandTotalCurrency ??
      data.totalProductPriceCurrency ??
      'USD') as Currency;

    const orderStatus = mapWcsOrderStatus(data.orderStatus ?? '');
    const inventoryStatus: OrderInventoryStatus =
      orderStatus === 'Shipped' ? 'Allocated' : 'NotAllocated';

    const userId: IdentityIdentifier = { userId: data.buyerId ?? '' };

    const result = {
      identifier: { key: data.orderId },
      userId,
      items: (data.orderItem ?? []).map((item) =>
        this.parseOrderItem(context, item, currency),
      ),
      price: this.parseCostBreakdown(context, data, currency),
      orderStatus,
      inventoryStatus,
      paymentInstructions: (data.paymentInstruction ?? []).map((pi) =>
        this.parsePaymentInstruction(context, pi, currency),
      ),
      shippingAddress: data.x_shippingAddress
        ? {
            identifier: {
              nickName: data.x_shippingAddress.nickName ?? '',
            },
            firstName: data.x_shippingAddress.firstName ?? '',
            lastName: data.x_shippingAddress.lastName ?? '',
            streetAddress:
              data.x_shippingAddress.addressLine?.[0] ??
              data.x_shippingAddress.address1 ??
              '',
            streetNumber: data.x_shippingAddress.addressLine?.[1] ?? '',
            city: data.x_shippingAddress.city ?? '',
            region: data.x_shippingAddress.state ?? '',
            postalCode: data.x_shippingAddress.zipCode ?? '',
            countryCode: data.x_shippingAddress.country ?? '',
          }
        : undefined,
      billingAddress: data.x_billingAddress
        ? {
            identifier: {
              nickName: data.x_billingAddress.nickName ?? '',
            },
            firstName: data.x_billingAddress.firstName ?? '',
            lastName: data.x_billingAddress.lastName ?? '',
            streetAddress:
              data.x_billingAddress.addressLine?.[0] ??
              data.x_billingAddress.address1 ??
              '',
            streetNumber: data.x_billingAddress.addressLine?.[1] ?? '',
            city: data.x_billingAddress.city ?? '',
            region: data.x_billingAddress.state ?? '',
            postalCode: data.x_billingAddress.zipCode ?? '',
            countryCode: data.x_billingAddress.country ?? '',
          }
        : undefined,
    } satisfies Order;

    return this.orderSchema.parse(result);
  }

  protected parseOrderItem(
    _context: RequestContext,
    item: HclWcsOrderItem,
    defaultCurrency: Currency,
  ): OrderItem {
    const currency = (item.currency ?? defaultCurrency) as Currency;
    const price: ItemCostBreakdown = {
      unitPrice: { value: Number(item.unitPrice), currency },
      totalPrice: { value: Number(item.orderItemPrice), currency },
      unitDiscount: { value: 0, currency },
      totalDiscount: { value: 0, currency },
    };

    return {
      identifier: { key: item.orderItemId },
      variant: { sku: item.partNumber },
      quantity: Number(item.quantity),
      price,
      inventoryStatus: 'Allocated',
    } satisfies OrderItem;
  }

  protected parseCostBreakdown(
    _context: RequestContext,
    data: HclWcsOrderDetailResponse,
    currency: Currency,
  ): CostBreakDown {
    return {
      grandTotal: { value: Number(data.grandTotal ?? '0'), currency },
      totalProductPrice: {
        value: Number(data.totalProductPrice ?? '0'),
        currency,
      },
      totalShipping: {
        value: Number(data.totalShippingCharge ?? '0'),
        currency,
      },
      totalTax: { value: Number(data.totalSalesTax ?? '0'), currency },
      totalDiscount: {
        value: Math.abs(Number(data.totalAdjustment ?? '0')),
        currency,
      },
      totalSurcharge: { value: 0, currency },
    };
  }

  protected parsePaymentInstruction(
    _context: RequestContext,
    pi: HclWcsPaymentInstruction,
    defaultCurrency: Currency,
  ): PaymentInstruction {
    const currency = (pi.currency ?? defaultCurrency) as Currency;
    const paymentMethod: PaymentMethodIdentifier = {
      method: pi.payMethodId,
      name: pi.piDescription ?? pi.payMethodId,
      paymentProcessor: pi.payMethodId,
    };

    return {
      identifier: { key: pi.piId },
      amount: { value: Number(pi.piAmount ?? '0'), currency },
      paymentMethod,
      protocolData: (pi.protocolData ?? []).map((pd) => ({
        key: pd.name,
        value: pd.value,
      })),
      status: 'pending',
    } satisfies PaymentInstruction;
  }
}
