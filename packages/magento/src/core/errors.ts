import type { MagentoGraphQLError } from '../schema/magento.types.js';

export type MagentoHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Magento renders REST failures as `{ message, parameters }`, where `message`
 * carries `%1` / `%fieldName` placeholders that `parameters` fills in, either
 * positionally (array) or by name (object).
 */
export type MagentoErrorParameters =
  | Array<string | number>
  | Record<string, string | number>;

export interface MagentoApiErrorDetails {
  transport: 'rest' | 'graphql';
  /** HTTP status. GraphQL failures reported inside a 200 keep the 200. */
  status: number;
  method: MagentoHttpMethod;
  /** The REST URL or the GraphQL endpoint. */
  url: string;
  /** Magento's own message with the parameters substituted, when one was returned. */
  magentoMessage?: string;
  parameters?: MagentoErrorParameters;
  /** The `errors` array of a GraphQL response. */
  graphqlErrors?: MagentoGraphQLError[];
  /** The raw response body, for diagnostics. */
  body?: string;
}

/**
 * A failed call to Magento, over REST or GraphQL. It is an `Error`, so
 * existing `catch` blocks keep working, but it carries enough structure for
 * callers to tell a missing entity from bad input or an auth failure.
 */
export class MagentoApiError extends Error {
  public override readonly name = 'MagentoApiError';
  public readonly transport: 'rest' | 'graphql';
  public readonly status: number;
  public readonly method: MagentoHttpMethod;
  public readonly url: string;
  public readonly magentoMessage?: string;
  public readonly parameters?: MagentoErrorParameters;
  public readonly graphqlErrors: MagentoGraphQLError[];
  public readonly body?: string;

  constructor(details: MagentoApiErrorDetails, message?: string) {
    super(message ?? describeMagentoApiError(details));
    this.transport = details.transport;
    this.status = details.status;
    this.method = details.method;
    this.url = details.url;
    this.magentoMessage = details.magentoMessage;
    this.parameters = details.parameters;
    this.graphqlErrors = details.graphqlErrors ?? [];
    this.body = details.body;
  }

  /**
   * The `extensions.category` of every GraphQL error, e.g.
   * `graphql-no-such-entity`, `graphql-input`, `graphql-authorization`.
   */
  public get categories(): string[] {
    const categories: string[] = [];
    for (const graphqlError of this.graphqlErrors) {
      const category = graphqlError.extensions?.['category'];
      if (typeof category === 'string') {
        categories.push(category);
      }
    }
    return categories;
  }

  public hasCategory(category: string): boolean {
    return this.categories.includes(category);
  }
}

export function isMagentoApiError(err: unknown): err is MagentoApiError {
  return err instanceof MagentoApiError;
}

function describeMagentoApiError(details: MagentoApiErrorDetails): string {
  const target =
    details.transport === 'graphql'
      ? `Magento GraphQL request failed: ${details.url} → ${details.status}`
      : `Magento request failed: ${details.method} ${details.url} → ${details.status}`;
  const graphqlReason = details.graphqlErrors?.map((e) => e.message).join('; ');
  const reason = details.magentoMessage || graphqlReason || details.body;
  return reason ? `${target}\n${reason}` : target;
}

/**
 * Substitutes Magento's `%1` / `%name` placeholders with their parameters.
 */
export function formatMagentoMessage(
  message: string,
  parameters?: MagentoErrorParameters,
): string {
  if (!parameters) {
    return message;
  }
  if (Array.isArray(parameters)) {
    return message.replace(/%(\d+)/g, (match, index: string) => {
      const value = parameters[Number(index) - 1];
      return value === undefined ? match : String(value);
    });
  }
  return message.replace(/%(\w+)/g, (match, name: string) => {
    const value = parameters[name];
    return value === undefined ? match : String(value);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

function readParameters(value: unknown): MagentoErrorParameters | undefined {
  if (Array.isArray(value)) {
    return value.filter(isScalar);
  }
  if (isRecord(value)) {
    const parameters: Record<string, string | number> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isScalar(entry)) {
        parameters[key] = entry;
      }
    }
    return parameters;
  }
  return undefined;
}

/**
 * Extracts `message` / `parameters` from a Magento REST error body. Anything
 * that is not Magento's JSON error shape (proxy pages, empty bodies) yields
 * no message, and the raw body is kept on the error instead.
 */
export function parseMagentoRestErrorBody(body: string): {
  magentoMessage?: string;
  parameters?: MagentoErrorParameters;
} {
  if (!body) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) {
    return {};
  }
  const message = parsed['message'];
  if (typeof message !== 'string') {
    return {};
  }
  const parameters = readParameters(parsed['parameters']);
  return {
    magentoMessage: formatMagentoMessage(message, parameters),
    parameters,
  };
}
