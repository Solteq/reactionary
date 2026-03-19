import type {
  StoreCart,
  StoreCartAddress,
  StoreCartLineItem,
  StoreCartShippingOptionWithServiceZone,
  StorePaymentProvider,
} from '@medusajs/types';
import {
  AddressIdentifierSchema,
  MonetaryAmountSchema,
  ShippingMethodIdentifierSchema,
  type Address,
  type AddressIdentifier,
  type AnyCheckoutSchema,
  type AnyPaymentMethodSchema,
  type AnyShippingMethodSchema,
  type Checkout,
  type CheckoutFactory,
  type CheckoutItem,
  type CheckoutSchema,
  type CostBreakDown,
  type Currency,
  type ItemCostBreakdown,
  type MonetaryAmount,
  type PaymentInstruction,
  type PaymentMethodIdentifier,
  type PaymentMethodSchema,
  type PointOfContact,
  type RequestContext,
  type ShippingMethod,
  type ShippingMethodSchema,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  MedusaCartIdentifier,
  MedusaOrderIdentifier,
} from '../../schema/medusa.schema.js';
import {
  parseMedusaCostBreakdown,
  parseMedusaItemPrice,
} from '../../utils/medusa-helpers.js';

export class MedusaCheckoutFactory<
  TCheckoutSchema extends AnyCheckoutSchema = typeof CheckoutSchema,
  TShippingMethodSchema extends
    AnyShippingMethodSchema = typeof ShippingMethodSchema,
  TPaymentMethodSchema extends
    AnyPaymentMethodSchema = typeof PaymentMethodSchema,
> implements
    CheckoutFactory<
      TCheckoutSchema,
      TShippingMethodSchema,
      TPaymentMethodSchema
    >
{
  public readonly checkoutSchema: TCheckoutSchema;
  public readonly shippingMethodSchema: TShippingMethodSchema;
  public readonly paymentMethodSchema: TPaymentMethodSchema;

  constructor(
    checkoutSchema: TCheckoutSchema,
    shippingMethodSchema: TShippingMethodSchema,
    paymentMethodSchema: TPaymentMethodSchema,
  ) {
    this.checkoutSchema = checkoutSchema;
    this.shippingMethodSchema = shippingMethodSchema;
    this.paymentMethodSchema = paymentMethodSchema;
  }

  /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
    _context: RequestContext,
    remoteItem: StoreCartLineItem,
    currency: Currency,
  ): ItemCostBreakdown {
    return parseMedusaItemPrice(remoteItem, currency);
  }

  /**
   * Extension point to control the parsing of the cost breakdown of a cart
   * @param remote
   * @returns
   */
  protected parseCostBreakdown(
    _context: RequestContext,
    remote: StoreCart,
  ): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }

  /**
   * Extension point to control the parsing of a single checkout item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseCheckoutItem(
    context: RequestContext,
    remoteItem: StoreCartLineItem,
    currency: Currency,
  ): CheckoutItem {
    const item: CheckoutItem = {
      identifier: {
        key: remoteItem.id,
      },
      variant: {
        sku: remoteItem.variant_sku || '',
      },
      quantity: remoteItem.quantity || 1,

      price: this.parseItemPrice(context, remoteItem, currency),
    };
    return item;
  }

  /**
   * Extension point to control the parsing of an address from a store cart address
   * @param storeAddress
   * @returns
   */
  protected parseAddress(
    _context: RequestContext,
    storeAddress: StoreCartAddress,
  ): Address {
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: storeAddress.id,
      } satisfies AddressIdentifier),
      firstName: storeAddress.first_name || '',
      lastName: storeAddress.last_name || '',
      streetAddress: storeAddress.address_1 || '',
      streetNumber: storeAddress.address_2 || '',
      city: storeAddress.city || '',
      postalCode: storeAddress.postal_code || '',
      countryCode: storeAddress.country_code || '',
      region: '',
    };
  }

  public parseCheckout(
    context: RequestContext,
    data: StoreCart,
  ): z.output<TCheckoutSchema> {
    const identifier = {
      key: data.id,
      //        region_id: remote.region_id,
    };

    const name = '' + (data.metadata?.['name'] || '');
    const description = '' + (data.metadata?.['description'] || '');

    const price = this.parseCostBreakdown(context, data);

    // Parse checkout items
    const items = new Array<CheckoutItem>();
    for (const remoteItem of data.items || []) {
      items.push(
        this.parseCheckoutItem(context, remoteItem, price.grandTotal.currency),
      );
    }

    const billingAddress = data.billing_address
      ? this.parseAddress(context, data.billing_address)
      : undefined;
    const shippingAddress = data.shipping_address
      ? this.parseAddress(context, data.shipping_address)
      : undefined;

    const backupUnattendedDelivery =
      data.metadata?.['consent_for_unattended_delivery'] !== undefined
        ? data.metadata?.['consent_for_unattended_delivery'] === 'true'
        : undefined;
    const backupInstructions =
      data.metadata?.['instructions'] !== undefined
        ? data.metadata?.['instructions'] + ''
        : undefined;
    const backupPickupPoint =
      data.metadata?.['pickup_point'] !== undefined
        ? data.metadata?.['pickup_point'] + ''
        : undefined;

    let shippingInstruction;
    data.shipping_methods?.forEach((sm) => {
      let pickupPoint = '';
      let instructions = '';
      let consentForUnattendedDelivery = false;
      if (sm.data) {
        pickupPoint = sm.data['pickup_point'] + '' || '';
        instructions = sm.data['instructions'] + '' || '';
        consentForUnattendedDelivery =
          sm.data['consent_for_unattended_delivery'] === 'true';
      }

      if (!pickupPoint) {
        pickupPoint = backupPickupPoint || '';
      }
      if (!instructions) {
        instructions = backupInstructions || '';
      }
      if (!consentForUnattendedDelivery) {
        consentForUnattendedDelivery = backupUnattendedDelivery || false;
      }

      // currently Medusa only supports one shipping method per cart
      shippingInstruction = {
        shippingMethod: { key: sm.shipping_option_id },
        consentForUnattendedDelivery,
        instructions,
        pickupPoint,
      };
    });

    const paymentInstructions = new Array<PaymentInstruction>();
    for (const remotePayment of data.payment_collection?.payment_sessions ||
      []) {
      if (
        remotePayment.status === 'canceled' ||
        remotePayment.status === 'error'
      ) {
        console.warn(
          `Skipping payment session ${remotePayment.id} with status ${remotePayment.status}`,
        );
        continue;
      }
      const paymentMethodIdentifier: PaymentMethodIdentifier = {
        method: remotePayment.provider_id,
        name: remotePayment.provider_id,
        paymentProcessor: remotePayment.provider_id,
      };

      paymentInstructions.push({
        identifier: {
          key: remotePayment.id,
        },
        amount: {
          value: remotePayment.amount,
          currency: remotePayment.currency_code?.toUpperCase() as Currency,
        },
        paymentMethod: paymentMethodIdentifier,
        protocolData: remotePayment.data
          ? Object.entries(remotePayment.data).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          : [],
        status: 'pending',
      });
    }

    const originalCartReference: MedusaCartIdentifier = {
      key: data.id,
      region: data.region_id,
    };

    const pointOfContact = {
      email: data.email || '',
      phone: data.metadata?.['sms_notification'] as string ?? undefined,
    } satisfies PointOfContact;

    let resultingOrder: MedusaOrderIdentifier | undefined = undefined;
    if (data.metadata?.['order_id']) {
      resultingOrder = {
        key: data.metadata?.['order_id'] + '' || '',
        display_id: Number(data.metadata?.['order_display_id'] + '' || '0'),
      };
    }

    const result: Checkout = {
      identifier,
      name,
      description,
      price,
      items,
      originalCartReference,
      paymentInstructions,
      readyForFinalization: false,
      billingAddress,
      resultingOrder,
      shippingAddress,
      shippingInstruction,
      pointOfContact,
    } satisfies Checkout;

    return this.checkoutSchema.parse(result);
  }

  public parseShippingMethod(
    _context: RequestContext,
    data: StoreCartShippingOptionWithServiceZone,
  ): z.output<TShippingMethodSchema> {
    const sm = {
      identifier: ShippingMethodIdentifierSchema.parse({ key: data.id }),
      name: data.name,
      description: data.type.description || '',
      price: MonetaryAmountSchema.parse({
        value: data.calculated_price.calculated_amount || 0,
        currency:
          data.calculated_price.currency_code?.toUpperCase() as Currency,
      } satisfies MonetaryAmount),
      deliveryTime: '',
    } satisfies ShippingMethod;

    return this.shippingMethodSchema.parse(sm);
  }

  public parsePaymentMethod(
    _context: RequestContext,
    data: StorePaymentProvider,
  ): z.output<TPaymentMethodSchema> {
    const pm = {
      identifier: {
        method: data.id,
        name: data.id,
        paymentProcessor: data.id,
      },
      logo: undefined,
      description: data.id,
      isPunchOut: true,
    };

    return this.paymentMethodSchema.parse(pm);
  }
}
