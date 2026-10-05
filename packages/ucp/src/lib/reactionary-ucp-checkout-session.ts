import type { Cart, Checkout, ShippingMethod } from '@reactionary/core';
import * as z from 'zod';
import type { ReactionaryUCPClient, UCPPaymentHandlers } from './reactionary-ucp-common.js';
import {
  createUCPError,
  createUcpCheckoutSuccessMetadata,
  createUcpErrorMessage,
  createUcpWarning,
  getMoneyCurrency,
  getMoneyValue,
  getSelectedPaymentInstrument,
  toOrderPermalinkUrl,
  toReactionaryAddress,
  toUcpCartLineItem,
  toUcpCostTotals,
  type UCPCheckout,
  type UCPLineItem,
  type UCPMessage,
  type UCPPostalAddress,
} from './reactionary-ucp-mapping.js';
import type {
  ReactionaryUCPSessionStore,
  UCPCheckoutSessionState,
} from './reactionary-ucp-session-store.js';
import type { components } from './ucp-shopping.openapi.js';

type UCPErrorResponse = components['schemas']['error_response'];
type UCPCheckoutResponse = components['schemas']['checkout_response'];
export type UCPCheckoutRequest = UCPCheckout & { cart_id?: string };

export const DEFAULT_UCP_PLACEHOLDER_EMAIL = 'pending@checkout.invalid';

/**
 * How long completion waits for the placed checkout to become
 * `readyForFinalization` — which implies an authorized payment, typically
 * recorded on the backend by a PSP webhook — before answering
 * `complete_in_progress`. A timeout of 0 disables waiting.
 */
export interface UCPPaymentAuthorizationWait {
  timeoutMs: number;
  intervalMs: number;
}

export const DEFAULT_UCP_PAYMENT_AUTHORIZATION_WAIT: UCPPaymentAuthorizationWait = {
  timeoutMs: 10_000,
  intervalMs: 1_000,
};

/**
 * A payment handler that exists only for testing. Agents complete with its
 * instruments, and the payment is placed through a real advertised handler
 * with a substitute credential (e.g. a PSP test token), so suites that
 * hardcode a mock handler still exercise real payments.
 */
export interface UCPTestPaymentHandler {
  /** The handler id agents send, e.g. the UCP conformance suite's `mock_payment_handler`. */
  id: string;
  /** Id of the advertised handler the payment is placed through, e.g. `stripe`. */
  delegateHandlerId: string;
  /**
   * Maps the agent's credential to one the delegate handler accepts.
   * Returning undefined declines the payment.
   */
  resolveCredential(credential: unknown): unknown;
}

/**
 * Line items are checked against the combined stock of these fulfillment
 * centers. Items without inventory records are treated as untracked.
 */
export interface UCPInventoryOptions {
  fulfillmentCenterKeys: string[];
}

async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  wait: UCPPaymentAuthorizationWait,
): Promise<T> {
  const deadline = Date.now() + wait.timeoutMs;
  let value = await read();

  while (!done(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait.intervalMs, Math.max(deadline - Date.now(), 0))));
    value = await read();
  }

  return value;
}

/**
 * A UCP checkout session is a mutable, progressively filled resource, while a
 * reactionary checkout is a frozen snapshot of a finished cart. Sessions are
 * therefore UCP-owned state over a reactionary cart: views are priced with a
 * transient reactionary checkout that is discarded again, and only completion
 * creates the real checkout.
 */
export interface UCPCheckoutSessionContext {
  client: ReactionaryUCPClient;
  store: ReactionaryUCPSessionStore;
  sessionId: string;
  paymentHandlers: UCPPaymentHandlers;
  placeholderEmail: string;
  paymentAuthorizationWait: UCPPaymentAuthorizationWait;
  /** The merchant's site URL, used to build order permalinks. */
  merchantUrl?: string;
  /** See ReactionaryUCPServerOptions.anonymousOrderEmail. */
  anonymousOrderEmail?: string;
  /** See ReactionaryUCPServerOptions.testPaymentHandlers. */
  testPaymentHandlers?: UCPTestPaymentHandler[];
  /** See ReactionaryUCPServerOptions.inventory. */
  inventory?: UCPInventoryOptions;
  /** The requesting platform's UCP-Agent profile URL. */
  agentProfile?: string;
  /** Email of the session's registered identity, if logged in. */
  getIdentityEmail(): Promise<string | undefined>;
  createCart(lineItems: UCPLineItem[]): Promise<Cart | UCPErrorResponse>;
  reconcileCart(cartId: string, lineItems: UCPLineItem[]): Promise<UCPErrorResponse | undefined>;
}

const PostalAddressRequestSchema = z.looseObject({
  id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  street_address: z.string().optional(),
  extended_address: z.string().optional(),
  address_locality: z.string().optional(),
  address_region: z.string().optional(),
  address_country: z.string().optional(),
  postal_code: z.string().optional(),
  phone_number: z.string().optional(),
});

// The fulfillment extension is not part of the generated base schema.
const FulfillmentRequestSchema = z.looseObject({
  methods: z.array(z.looseObject({
    selected_destination_id: z.string().nullish(),
    destinations: z.array(PostalAddressRequestSchema).optional(),
    groups: z.array(z.looseObject({
      selected_option_id: z.string().nullish(),
    })).optional(),
  })).optional(),
});

export async function createCheckoutSession(
  context: UCPCheckoutSessionContext,
  body: UCPCheckoutRequest,
): Promise<UCPCheckoutResponse> {
  if (!context.client.checkout || !context.client.cart) {
    return createUCPError('not_available', 'Checkout capability is not available.');
  }

  let cart: Cart | UCPErrorResponse | undefined;
  if (body.cart_id) {
    cart = await getCart(context, body.cart_id);
  } else if (body.line_items?.length) {
    cart = await context.createCart(body.line_items);
  }

  if (!cart) {
    return createUCPError('invalid_request', 'A checkout session requires cart_id or line_items.');
  }

  if (!('identifier' in cart)) {
    return cart;
  }

  const state: UCPCheckoutSessionState = {
    id: `checkout_${crypto.randomUUID()}`,
    cartId: cart.identifier.key,
    status: 'open',
  };
  mergeRequestIntoState(state, body);

  await context.store.putCheckoutSession(state);
  await context.store.bindResource(state.id, context.sessionId);

  return (await buildOpenView(context, state)).response;
}

export async function getCheckoutSession(
  context: UCPCheckoutSessionContext,
  checkoutSessionId: string,
): Promise<UCPCheckoutResponse> {
  const state = await context.store.getCheckoutSession(checkoutSessionId);

  if (!state) {
    return checkoutSessionNotFound(checkoutSessionId);
  }

  return state.finalCheckoutId
    ? buildFinalView(context, state)
    : (await buildOpenView(context, state)).response;
}

export async function updateCheckoutSession(
  context: UCPCheckoutSessionContext,
  checkoutSessionId: string,
  body: UCPCheckoutRequest,
): Promise<UCPCheckoutResponse> {
  const state = await context.store.getCheckoutSession(checkoutSessionId);

  if (!state) {
    return checkoutSessionNotFound(checkoutSessionId);
  }

  if (state.finalCheckoutId || state.status === 'canceled') {
    return createUCPError('checkout_not_modifiable', 'The checkout session can no longer be modified.');
  }

  // PUT is a full replacement, but an empty line item list is treated as
  // "unchanged" rather than as emptying the cart.
  if (body.line_items?.length) {
    const failure = await context.reconcileCart(state.cartId, body.line_items);

    if (failure) {
      return failure;
    }
  }

  mergeRequestIntoState(state, body);
  await context.store.putCheckoutSession(state);

  return (await buildOpenView(context, state)).response;
}

export async function cancelCheckoutSession(
  context: UCPCheckoutSessionContext,
  checkoutSessionId: string,
): Promise<UCPCheckoutResponse> {
  const state = await context.store.getCheckoutSession(checkoutSessionId);

  if (!state) {
    return checkoutSessionNotFound(checkoutSessionId);
  }

  if (state.finalCheckoutId) {
    return createUCPError('checkout_not_modifiable', 'A completed checkout session cannot be canceled.');
  }

  state.status = 'canceled';
  await context.store.putCheckoutSession(state);

  return (await buildOpenView(context, state)).response;
}

/**
 * Creates the real checkout from the session state and finalizes it. When the
 * backend is not ready yet — typically a payment awaiting the payment service
 * provider's asynchronous authorization — the session reports
 * `complete_in_progress`, and a repeated complete retries finalization.
 */
export async function completeCheckoutSession(
  context: UCPCheckoutSessionContext,
  checkoutSessionId: string,
  body: UCPCheckoutRequest,
): Promise<UCPCheckoutResponse> {
  const state = await context.store.getCheckoutSession(checkoutSessionId);

  if (!state) {
    return checkoutSessionNotFound(checkoutSessionId);
  }

  if (state.status === 'canceled' || state.status === 'completed') {
    return createUCPError('checkout_not_modifiable', `A ${state.status} checkout session cannot be completed.`);
  }

  const messages: UCPMessage[] = [];

  if (!state.finalCheckoutId) {
    // The complete request carries the final buyer and payment data.
    mergeRequestIntoState(state, body);

    const { response, ready } = await buildOpenView(context, state);

    if (!ready) {
      return response;
    }

    // The payment credential is used for the real checkout only, never stored.
    const payment = resolvePayment(context, state, getSelectedPaymentInstrument(body)?.credential);

    if (!payment) {
      return addMessages(response, [
        createUcpErrorMessage('payment_failed', 'The payment credential was declined.', '$.payment.instruments'),
      ], 'incomplete');
    }

    const placement = await placeFinalCheckout(context, state, payment);

    if (placement.failure) {
      return addMessages(response, [placement.failure], 'incomplete');
    }

    messages.push(...placement.messages);
  }

  return finalizeIfReady(context, state, messages);
}

interface UCPResolvedPayment {
  handlerId: string;
  credential: unknown;
}

/**
 * The handler and credential the payment is placed with: the agent's own,
 * or, for a test handler, its delegate with the substitute credential.
 * Undefined when a test handler declines the credential.
 */
function resolvePayment(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
  credential: unknown,
): UCPResolvedPayment | undefined {
  const handlerId = state.instrument?.handler_id ?? '';
  const testHandler = context.testPaymentHandlers?.find((handler) => handler.id === handlerId);

  if (!testHandler) {
    return { handlerId, credential };
  }

  const substitute = testHandler.resolveCredential(credential);

  return substitute === undefined
    ? undefined
    : { handlerId: testHandler.delegateHandlerId, credential: substitute };
}

/**
 * Businesses MUST confirm an instrument's handler is one they advertise
 * (payment handler spec, "Processing Payments"). Without advertised handlers
 * there is nothing to check against, so any handler is passed through.
 */
function isAcceptedPaymentHandler(
  context: UCPCheckoutSessionContext,
  handlerId: string,
): boolean {
  const advertised = Object.values(context.paymentHandlers).flat();

  return advertised.length === 0
    || advertised.some((handler) => handler.id === handlerId)
    || Boolean(context.testPaymentHandlers?.some((handler) => handler.id === handlerId));
}

function mergeRequestIntoState(
  state: UCPCheckoutSessionState,
  body: UCPCheckoutRequest,
): void {
  if (body.buyer) {
    state.buyer = {
      ...state.buyer,
      ...(body.buyer.first_name ? { first_name: body.buyer.first_name } : {}),
      ...(body.buyer.last_name ? { last_name: body.buyer.last_name } : {}),
      ...(body.buyer.email ? { email: body.buyer.email } : {}),
      ...(body.buyer.phone_number ? { phone_number: body.buyer.phone_number } : {}),
    };
  }

  const instrument = getSelectedPaymentInstrument(body);
  if (instrument?.billing_address) {
    state.billingAddress = instrument.billing_address;
  }

  // getSelectedPaymentInstrument already prefers the explicitly selected
  // instrument and falls back to a sole one, matching how the credential is
  // resolved on completion.
  if (instrument) {
    state.instrument = {
      id: instrument.id,
      handler_id: instrument.handler_id,
      type: instrument.type,
    };
  }

  const fulfillment = FulfillmentRequestSchema.safeParse(body['fulfillment']);
  const method = fulfillment.success ? fulfillment.data.methods?.[0] : undefined;

  if (method) {
    const destinations = method.destinations ?? [];
    const destination = destinations.find((candidate) => candidate.id === method.selected_destination_id)
      ?? (destinations.length === 1 ? destinations[0] : undefined);

    if (destination) {
      state.destination = destination;
    }

    const selectedOptionId = method.groups?.[0]?.selected_option_id;
    if (selectedOptionId) {
      state.selectedOptionId = selectedOptionId;
    } else if (selectedOptionId === null) {
      delete state.selectedOptionId;
    }
  }
}

/**
 * The buyer's email as supplied over UCP, falling back to the logged-in
 * identity's profile email.
 */
async function resolveBuyerEmail(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
): Promise<string | undefined> {
  const email = state.buyer?.email ?? (await context.getIdentityEmail());

  if (!email && context.anonymousOrderEmail) {
    console.warn(
      `UCP: checkout session ${state.id} has no buyer email; using the configured anonymousOrderEmail — `
      + 'an order placed this way cannot send the buyer a receipt.',
    );
    return context.anonymousOrderEmail;
  }

  return email;
}

interface TransientPricing {
  checkout?: Checkout;
  options: ShippingMethod[];
  failure?: UCPMessage;
}

/**
 * Prices the session with a throwaway checkout. Backends need an email to
 * quote, so the placeholder stands in until the buyer supplies one.
 */
async function priceWithTransientCheckout(
  context: UCPCheckoutSessionContext,
  cart: Cart,
  state: UCPCheckoutSessionState,
): Promise<TransientPricing> {
  const address = state.destination ?? state.billingAddress;
  const checkoutCapability = context.client.checkout;

  if (!address || !checkoutCapability) {
    return { options: [] };
  }

  const initiated = await checkoutCapability.initiateCheckoutForCart({
    cart,
    billingAddress: toReactionaryAddress(state.billingAddress ?? address),
    notificationEmail: (await resolveBuyerEmail(context, state)) ?? context.placeholderEmail,
    ...(state.buyer?.phone_number ? { notificationPhone: state.buyer.phone_number } : {}),
  });

  if (!initiated.success) {
    return {
      options: [],
      failure: createUcpErrorMessage('checkout_pricing_failed', 'Unable to price the checkout for the given address.'),
    };
  }

  let checkout = initiated.value;

  try {
    checkout = await applyFulfillment(context, checkout, state);
    const options = await getShippingOptions(context, checkout);

    return { checkout, options };
  } finally {
    await discardTransientCheckout(context, cart, checkout);
  }
}

async function applyFulfillment(
  context: UCPCheckoutSessionContext,
  checkout: Checkout,
  state: UCPCheckoutSessionState,
): Promise<Checkout> {
  const checkoutCapability = context.client.checkout;
  let current = checkout;

  if (state.destination && checkoutCapability?.setShippingAddress) {
    const result = await checkoutCapability.setShippingAddress({
      checkout: current.identifier,
      shippingAddress: toReactionaryAddress(state.destination),
    });

    if (result.success) {
      current = result.value;
    }
  }

  if (state.selectedOptionId && checkoutCapability?.setShippingInstruction) {
    const result = await checkoutCapability.setShippingInstruction({
      checkout: current.identifier,
      shippingInstruction: {
        shippingMethod: { key: state.selectedOptionId },
        instructions: '',
        pickupPoint: '',
        consentForUnattendedDelivery: false,
      },
    });

    if (result.success) {
      current = result.value;
    }
  }

  return current;
}

async function getShippingOptions(
  context: UCPCheckoutSessionContext,
  checkout: Checkout,
): Promise<ShippingMethod[]> {
  const checkoutCapability = context.client.checkout;

  if (!checkoutCapability?.getAvailableShippingMethods) {
    return [];
  }

  const result = await checkoutCapability.getAvailableShippingMethods({ checkout: checkout.identifier });

  return result.success ? result.value : [];
}

/**
 * Providers whose checkout is a copy of the cart (commercetools replicates
 * it) leave an orphan per transient checkout, so it is deleted. Where the
 * checkout is the cart itself (same key), there is nothing to discard.
 */
async function discardTransientCheckout(
  context: UCPCheckoutSessionContext,
  cart: Cart,
  checkout: Checkout,
): Promise<void> {
  if (checkout.identifier.key === cart.identifier.key || !context.client.cart) {
    return;
  }

  await context.client.cart.deleteCart({ cart: checkout.identifier });
}

async function buildOpenView(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
): Promise<{ response: UCPCheckoutResponse; ready: boolean }> {
  const cart = await getCart(context, state.cartId);

  if (!('identifier' in cart)) {
    return { response: cart, ready: false };
  }

  const pricing = state.status === 'canceled'
    ? { options: [] }
    : await priceWithTransientCheckout(context, cart, state);
  const price = pricing.checkout?.price ?? cart.price;
  const messages = [
    ...await getStockMessages(context, cart),
    ...getMissingInputMessages(context, state, pricing, await resolveBuyerEmail(context, state)),
  ];
  const ready = state.status === 'open' && messages.length === 0;

  state.lastTotal = getMoneyValue(price.grandTotal);
  const selectedOptionTitle = state.selectedOptionId
    ? getOptionTitles(pricing.options).get(state.selectedOptionId)
    : undefined;
  if (selectedOptionTitle) {
    state.selectedOptionTitle = selectedOptionTitle;
  }
  await context.store.putCheckoutSession(state);

  const response: UCPCheckout = {
    id: state.id,
    status: state.status === 'canceled' ? 'canceled' : ready ? 'ready_for_complete' : 'incomplete',
    line_items: cart.items.map(toUcpCartLineItem),
    currency: getMoneyCurrency(price.grandTotal),
    totals: toUcpCostTotals(price),
    links: [],
    ...(state.buyer ? { buyer: state.buyer } : {}),
    ...toUcpPayment(state),
    ...toUcpFulfillment(context, cart, state, pricing.options),
    ...(messages.length > 0 ? { messages } : {}),
    ucp: createUcpCheckoutSuccessMetadata(context.paymentHandlers),
  };

  return { response, ready };
}

/**
 * An out_of_stock error per line item requesting more than the configured
 * fulfillment centers hold. Back-ordered and pre-ordered items are always
 * purchasable.
 */
async function getStockMessages(
  context: UCPCheckoutSessionContext,
  cart: Cart,
): Promise<UCPMessage[]> {
  const inventoryCapability = context.client.inventory;
  const fulfillmentCenterKeys = context.inventory?.fulfillmentCenterKeys ?? [];

  if (!inventoryCapability || fulfillmentCenterKeys.length === 0) {
    return [];
  }

  const messages = await Promise.all(cart.items.map(async (item, index) => {
    const results = await Promise.all(fulfillmentCenterKeys.map((key) => inventoryCapability.getBySKU({
      variant: item.variant,
      fulfilmentCenter: { key },
    })));
    const inventories = results.flatMap((result) => (result.success ? [result.value] : []));

    if (
      inventories.length === 0
      || inventories.some((inventory) => inventory.status === 'onBackOrder' || inventory.status === 'preOrder')
    ) {
      return undefined;
    }

    const available = inventories.reduce(
      (total, inventory) => total + (inventory.status === 'inStock' ? Math.max(inventory.quantity, 0) : 0),
      0,
    );

    if (item.quantity <= available) {
      return undefined;
    }

    const sku = item.variant.sku;
    return createUcpErrorMessage(
      'out_of_stock',
      available > 0 ? `Only ${available} of ${sku} are in stock.` : `${sku} is out of stock.`,
      `$.line_items[${index}]`,
    );
  }));

  return messages.filter((message) => message !== undefined);
}

function getMissingInputMessages(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
  pricing: TransientPricing,
  email: string | undefined,
): UCPMessage[] {
  const messages: UCPMessage[] = pricing.failure ? [pricing.failure] : [];

  if (!email) {
    messages.push(createUcpErrorMessage('missing', 'A buyer email is required to complete the checkout.', '$.buyer.email'));
  }

  // A billing address stands in for the destination only when the backend
  // cannot ship; otherwise the checkout would be placed without shipping and
  // never become ready for finalization.
  if (context.client.checkout?.setShippingAddress) {
    if (!state.destination) {
      messages.push(createUcpErrorMessage('missing', 'A shipping destination is required.', '$.fulfillment.methods[0].destinations'));
    }
  } else if (!state.destination && !state.billingAddress) {
    messages.push(createUcpErrorMessage('missing', 'A shipping destination or billing address is required.', '$.fulfillment.methods[0].destinations'));
  }

  if (
    pricing.options.length > 0 &&
    !pricing.options.some((option) => option.identifier.key === state.selectedOptionId)
  ) {
    messages.push(createUcpErrorMessage('missing', 'A fulfillment option must be selected.', '$.fulfillment.methods[0].groups[0].selected_option_id'));
  }

  if (!state.instrument) {
    messages.push(createUcpErrorMessage('missing', 'A payment instrument must be selected.', '$.payment.instruments'));
  } else if (!isAcceptedPaymentHandler(context, state.instrument.handler_id)) {
    messages.push(createUcpErrorMessage(
      'payment_failed',
      `Payment handler '${state.instrument.handler_id}' is not supported by this business.`,
      '$.payment.instruments',
    ));
  }

  return messages;
}

function toUcpPayment(state: UCPCheckoutSessionState): { payment?: UCPCheckout['payment'] } {
  const candidate: unknown = {
    instruments: state.instrument
      ? [{
        id: state.instrument.id,
        handler_id: state.instrument.handler_id,
        type: state.instrument.type,
        selected: true,
        ...(state.billingAddress ? { billing_address: state.billingAddress } : {}),
      }]
      : [],
  };

  return isUcpPayment(candidate) ? { payment: candidate } : {};
}

// The generated instrument type requires a `$defs` codegen artifact no
// response carries, so validate the runtime shape instead of casting.
function isUcpPayment(value: unknown): value is UCPCheckout['payment'] {
  const instruments: unknown = typeof value === 'object' && value !== null
    ? Reflect.get(value, 'instruments')
    : undefined;

  return Array.isArray(instruments) && instruments.every(
    (instrument: unknown) =>
      typeof instrument === 'object' &&
      instrument !== null &&
      typeof Reflect.get(instrument, 'id') === 'string' &&
      typeof Reflect.get(instrument, 'handler_id') === 'string',
  );
}

function toUcpFulfillment(
  context: UCPCheckoutSessionContext,
  cart: Cart,
  state: UCPCheckoutSessionState,
  options: ShippingMethod[],
): { fulfillment?: Record<string, unknown> } {
  const destination = state.destination;

  if (!context.client.checkout?.getAvailableShippingMethods) {
    return {};
  }

  const lineItemIds = cart.items.map((item) => item.identifier.key);
  const destinationId = destination?.id ?? 'destination_1';
  const titles = getOptionTitles(options);
  const selectedOptionId = options.some((option) => option.identifier.key === state.selectedOptionId)
    ? state.selectedOptionId
    : undefined;

  return {
    fulfillment: {
      methods: [
        {
          id: 'shipping',
          type: 'shipping',
          line_item_ids: lineItemIds,
          destinations: destination ? [{ ...destination, id: destinationId }] : [],
          ...(destination ? { selected_destination_id: destinationId } : {}),
          groups: [
            {
              id: 'group_1',
              line_item_ids: lineItemIds,
              options: options.map((option) => ({
                id: option.identifier.key,
                title: titles.get(option.identifier.key) ?? option.identifier.key,
                totals: [{ type: 'total', amount: getMoneyValue(option.price) }],
              })),
              ...(selectedOptionId ? { selected_option_id: selectedOptionId } : {}),
            },
          ],
        },
      ],
    },
  };
}

/** Option titles by option key; sibling titles must be distinct for buyers to choose. */
function getOptionTitles(options: ShippingMethod[]): Map<string, string> {
  const titles = new Map<string, string>();
  const used = new Set<string>();

  for (const option of options) {
    let title = option.name || option.identifier.key;
    if (used.has(title)) {
      title = `${title} (${option.identifier.key})`;
    }
    used.add(title);
    titles.set(option.identifier.key, title);
  }

  return titles;
}

async function placeFinalCheckout(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
  payment: UCPResolvedPayment,
): Promise<{ failure?: UCPMessage; messages: UCPMessage[] }> {
  const checkoutCapability = context.client.checkout;
  const address = state.destination ?? state.billingAddress;
  const email = await resolveBuyerEmail(context, state);
  const instrument = state.instrument;
  const cart = await getCart(context, state.cartId);

  if (!checkoutCapability || !address || !email || !instrument || !('identifier' in cart)) {
    return {
      failure: createUcpErrorMessage('checkout_complete_failed', 'The checkout session is missing data required to complete it.'),
      messages: [],
    };
  }

  const initiated = await checkoutCapability.initiateCheckoutForCart({
    cart,
    billingAddress: toReactionaryAddress(state.billingAddress ?? address),
    notificationEmail: email,
    ...(state.buyer?.phone_number ? { notificationPhone: state.buyer.phone_number } : {}),
  });

  if (!initiated.success) {
    return {
      failure: createUcpErrorMessage('checkout_complete_failed', 'The checkout could not be created.'),
      messages: [],
    };
  }

  const checkout = await applyFulfillment(context, initiated.value, state);
  const paid = await checkoutCapability.addPaymentInstruction({
    checkout: checkout.identifier,
    paymentInstruction: {
      amount: checkout.price.grandTotal,
      paymentMethod: {
        method: instrument.type,
        name: instrument.id,
        paymentProcessor: payment.handlerId,
      },
      protocolData: [
        { key: 'ucp_payment_instrument_id', value: instrument.id },
        { key: 'ucp_payment_handler_id', value: payment.handlerId },
        { key: 'ucp_payment_instrument_type', value: instrument.type },
        // Passed verbatim: the credential's shape is defined by the payment
        // handler, and the backend's payment integration interprets it.
        ...(payment.credential ? [{ key: 'ucp_payment_credential', value: JSON.stringify(payment.credential) }] : []),
      ],
    },
  });

  if (!paid.success) {
    return {
      failure: createUcpErrorMessage('payment_failed', 'The payment instruction could not be added.', '$.payment.instruments'),
      messages: [],
    };
  }

  const messages: UCPMessage[] = [];
  const finalTotal = getMoneyValue(paid.value.price.grandTotal);

  if (state.lastTotal !== undefined && state.lastTotal !== finalTotal) {
    messages.push(createUcpWarning('price_changed', 'The total changed since the checkout session was last shown.', '$.totals'));
  }

  state.finalCheckoutId = paid.value.identifier.key;
  state.status = 'complete_in_progress';
  await context.store.putCheckoutSession(state);

  return { messages };
}

async function finalizeIfReady(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
  messages: UCPMessage[],
): Promise<UCPCheckoutResponse> {
  const checkoutCapability = context.client.checkout;

  if (state.status !== 'completed' && checkoutCapability && state.finalCheckoutId) {
    const finalCheckoutId = state.finalCheckoutId;
    const current = await pollUntil(
      () => checkoutCapability.getById({ identifier: { key: finalCheckoutId } }),
      (result) => !result.success || Boolean(result.value.resultingOrder || result.value.readyForFinalization),
      context.paymentAuthorizationWait,
    );

    if (current.success && current.value.resultingOrder) {
      state.status = 'completed';
      state.orderId = current.value.resultingOrder.key;
    } else if (current.success && current.value.readyForFinalization) {
      const finalized = await checkoutCapability.finalizeCheckout({ checkout: current.value.identifier });

      if (finalized.success) {
        state.status = 'completed';
        state.orderId = finalized.value.resultingOrder?.key;
      } else {
        messages.push(createUcpErrorMessage('checkout_complete_failed', 'Checkout completion failed.'));
      }
    }

    await context.store.putCheckoutSession(state);
    await recordOrder(context, state);
  }

  return buildFinalView(context, state, messages);
}

/**
 * Records the completed checkout's order: its origin, which GET /orders
 * reports and checks the requesting platform against, and the fulfillment
 * the agent selected, which backend orders may not carry.
 */
async function recordOrder(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
): Promise<void> {
  if (state.status !== 'completed' || !state.orderId || await context.store.getOrder(state.orderId)) {
    return;
  }

  await context.store.putOrder({
    id: state.orderId,
    checkoutSessionId: state.id,
    sessionId: context.sessionId,
    ...(context.agentProfile ? { agentProfile: context.agentProfile } : {}),
    ...(state.destination ? { destination: state.destination } : {}),
    ...(state.selectedOptionTitle ? { fulfillmentTitle: state.selectedOptionTitle } : {}),
    events: [],
    adjustments: [],
  });
}

async function buildFinalView(
  context: UCPCheckoutSessionContext,
  state: UCPCheckoutSessionState,
  messages: UCPMessage[] = [],
): Promise<UCPCheckoutResponse> {
  const result = state.finalCheckoutId
    ? await context.client.checkout?.getById({ identifier: { key: state.finalCheckoutId } })
    : undefined;

  if (!result?.success) {
    return createUCPError('not_found', `Checkout was not found for session: ${state.id}`);
  }

  const checkout = result.value;
  const orderId = state.orderId ?? checkout.resultingOrder?.key;

  return {
    id: state.id,
    status: state.status === 'completed' ? 'completed' : 'complete_in_progress',
    line_items: checkout.items.map(toUcpCartLineItem),
    currency: getMoneyCurrency(checkout.price.grandTotal),
    totals: toUcpCostTotals(checkout.price),
    links: [],
    ...(state.buyer ? { buyer: state.buyer } : {}),
    ...(orderId ? { order: { id: orderId, permalink_url: toOrderPermalinkUrl(context.merchantUrl, orderId) } } : {}),
    ...(messages.length > 0 ? { messages } : {}),
    ucp: createUcpCheckoutSuccessMetadata(context.paymentHandlers),
  };
}

async function getCart(
  context: UCPCheckoutSessionContext,
  cartId: string,
): Promise<Cart | UCPErrorResponse> {
  const result = await context.client.cart?.getById({ cart: { key: cartId } });

  return result?.success
    ? result.value
    : createUCPError('not_found', `Cart was not found: ${cartId}`);
}

function addMessages(
  response: UCPCheckoutResponse,
  messages: UCPMessage[],
  status: UCPCheckout['status'],
): UCPCheckoutResponse {
  if (!('id' in response)) {
    return response;
  }

  return {
    ...response,
    status,
    messages: [...(response.messages ?? []), ...messages],
  };
}

function checkoutSessionNotFound(checkoutSessionId: string): UCPErrorResponse {
  return createUCPError('not_found', `Checkout session was not found: ${checkoutSessionId}`);
}

export type { UCPPostalAddress };
