import type {
  StorePaymentCollection} from '@medusajs/types';
import {
  type StoreCart,
  type StoreCartAddress,
  type StoreCartLineItem,
  type StoreCartShippingOptionWithServiceZone,
  type StoreOrderAddress,
  type StorePaymentProvider,
  type StorePaymentSession,
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
  type PaymentStatus,
  type PointOfContact,
  type RequestContext,
  type ShippingInstruction,
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
    remoteItem: StoreCartLineItem ,
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
    remote: StoreCart ,
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

  protected isReadyForFinalization(
    price: CostBreakDown,
    paymentInstructions: PaymentInstruction[],
    billingAddress?: Address,
    shippingAddress?: Address,
    shippingInstruction?: ShippingInstruction,
  ): boolean {
    if (!billingAddress) return false;
    if (!shippingInstruction) return false;
    if (!shippingAddress && !shippingInstruction.pickupPoint) return false;
    if (paymentInstructions.length === 0) return false;

    const authorizedPayments = paymentInstructions
      .filter((paymentInstruction) => paymentInstruction.status === 'authorized')
      .map((paymentInstruction) => paymentInstruction.amount.value)
      .reduce((sum, value) => sum + value, 0);

    if (price.grandTotal.value !== authorizedPayments) return false;

    return true;
  }

  protected isCart(data: StoreCart): data is StoreCart {
    return (data as StoreCart).payment_collection !== undefined;
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

    if (data.payment_collection) {
      const paymentInstruction = this.parsePaymentInstruction(context, data.payment_collection, data);
      if (paymentInstruction) {
        paymentInstructions.push(paymentInstruction);
      }
    }



    const originalCartReference: MedusaCartIdentifier = {
      key: data.id,
      region_id: data.region_id,
    } satisfies MedusaCartIdentifier;

    const pointOfContact = {
      email: data.email || '',
      phone: data.metadata?.['sms_notification'] as string ?? undefined,
    } satisfies PointOfContact;

    let resultingOrder: MedusaOrderIdentifier | undefined = undefined;
    let displayId: number | undefined = undefined;
    if ((data as any)['order']?.custom_display_id) {
      displayId = Number((data as any)['order'].custom_display_id + '' || '0');
    } else if ((data as any)['order']?.display_id) {
      displayId = Number((data as any)['order'].display_id + '' || '0');
    }

    if ((data as any)['order']?.id) {
      resultingOrder = {
        key: (data as any)['order'].id || '',
        display_id: displayId,
      } satisfies MedusaOrderIdentifier;
    }

    const readyForFinalization = this.isReadyForFinalization(
      price,
      paymentInstructions,
      billingAddress,
      shippingAddress,
      shippingInstruction,
    );

    const result: Checkout = {
      identifier,
      name,
      description,
      price,
      items,
      originalCartReference,
      paymentInstructions,
      readyForFinalization,
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


  protected parsePaymentInstruction(_context: RequestContext, remotePayment: StorePaymentCollection, checkout: StoreCart) {

      const mainSession = (remotePayment.payment_sessions || []).find(
        (session) => session.status !== 'canceled' && session.status !== 'error',
      ) as StorePaymentSession;
      if  (!mainSession) {
        console.log(`Skipping collection ${remotePayment.id} because it has no valid payment sessions`);
        return undefined;
      }

      const paymentMethodIdentifier: PaymentMethodIdentifier = {
        method: mainSession.provider_id,
        name: mainSession.provider_id,
        paymentProcessor: mainSession.provider_id,
      };

      let status: PaymentInstruction['status'] = 'pending';
      switch (remotePayment.status) {
        case 'not_paid':
          status = 'pending';
          break;
        case 'awaiting':
          status = 'pending';
          break;
        case 'authorized':
          status = 'authorized';
          break;
        case 'partially_authorized':
          status = 'pending';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'failed':
          status = 'canceled';
          break;
        case 'completed':
          status = 'capture';
          break;
      }

      const paymentData = mainSession.data || {};
      const pi = {
        identifier: {
          key: remotePayment.id,
        },
        amount: {
          value: remotePayment.amount,
          currency: remotePayment.currency_code?.toUpperCase() as Currency,
        },
        paymentMethod: paymentMethodIdentifier,
        protocolData: paymentData
          ? Object.entries(paymentData).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          : [],
        status,
      } satisfies PaymentInstruction;
    return pi;
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
