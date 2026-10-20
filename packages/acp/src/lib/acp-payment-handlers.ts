import type { PaymentMethod } from '@reactionary/core';

/**
 * A payment handler declaration, as advertised in a checkout session's
 * `capabilities.payment.handlers` (payment handlers RFC §5.1).
 */
export interface ACPPaymentHandler {
  /** Seller-defined handler id, referenced by `payment_data.handler_id`. */
  id: string;
  /** Handler specification name in reverse-DNS format, e.g. `dev.acp.tokenized.card`. */
  name: string;
  /** Human-readable name for payment UIs, e.g. `Credit Card`. */
  display_name?: string;
  /** Handler specification version, `YYYY-MM-DD`. */
  version: string;
  spec: string;
  requires_delegate_payment: boolean;
  requires_pci_compliance: boolean;
  /** The seller's payment service provider, e.g. `stripe`. */
  psp: string;
  config_schema: string;
  instrument_schemas: string[];
  /** Handler-specific configuration; MUST include `merchant_id` and `psp` (RFC §10). */
  config: ACPPaymentHandlerConfig;
  /** Suggested display order, lower first. Agents may reorder. */
  display_order?: number;
}

export interface ACPPaymentHandlerConfig {
  /** The seller's account with the PSP; agents scope delegated tokens to it. */
  merchant_id: string;
  psp: string;
  [key: string]: unknown;
}

/**
 * A payment handler the server advertises, and the backend payment method its
 * payments are placed with.
 */
export interface ACPPaymentHandlerOption {
  handler: ACPPaymentHandler;
  /**
   * The reactionary payment method used for the payment instruction.
   * Defaults to method `card` with the handler's PSP as name and processor.
   */
  paymentMethod?: PaymentMethod['identifier'];
}

const TOKENIZED_CARD_VERSION = '2026-01-22';

export interface ACPTokenizedCardHandlerOptions {
  id?: string;
  psp: string;
  merchantId: string;
  displayName?: string;
  acceptedBrands?: string[];
  acceptedFundingTypes?: Array<'credit' | 'debit' | 'prepaid'>;
  supports3ds?: boolean;
  displayOrder?: number;
  paymentMethod?: PaymentMethod['identifier'];
  /** Additional handler configuration, e.g. `merchant_display_name`. */
  config?: Record<string, unknown>;
}

/**
 * The reference card handler, `dev.acp.tokenized.card`: delegated payment
 * tokens (SPTs) minted by the seller's PSP for its merchant account.
 */
export function createTokenizedCardHandler(
  options: ACPTokenizedCardHandlerOptions,
): ACPPaymentHandlerOption {
  return {
    handler: {
      id: options.id ?? 'card_tokenized',
      name: 'dev.acp.tokenized.card',
      ...(options.displayName ? { display_name: options.displayName } : {}),
      version: TOKENIZED_CARD_VERSION,
      spec: 'https://acp.dev/handlers/tokenized.card',
      requires_delegate_payment: true,
      requires_pci_compliance: false,
      psp: options.psp,
      config_schema: 'https://acp.dev/schemas/handlers/tokenized.card/config.json',
      instrument_schemas: ['https://acp.dev/schemas/handlers/tokenized.card/instrument.json'],
      config: {
        ...options.config,
        merchant_id: options.merchantId,
        psp: options.psp,
        ...(options.acceptedBrands ? { accepted_brands: options.acceptedBrands } : {}),
        ...(options.acceptedFundingTypes ? { accepted_funding_types: options.acceptedFundingTypes } : {}),
        ...(options.supports3ds !== undefined ? { supports_3ds: options.supports3ds } : {}),
      },
      ...(options.displayOrder !== undefined ? { display_order: options.displayOrder } : {}),
    },
    ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
  };
}

/** The backend payment method a handler's payments are placed with. */
export function getHandlerPaymentMethod(option: ACPPaymentHandlerOption): PaymentMethod['identifier'] {
  return option.paymentMethod ?? {
    method: 'card',
    name: option.handler.psp,
    paymentProcessor: option.handler.psp,
  };
}
