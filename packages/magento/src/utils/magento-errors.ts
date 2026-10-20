import type {
  Fail,
  GenericError,
  InvalidInputError,
  NotFoundError,
} from '@reactionary/core';
import { error } from '@reactionary/core';
import createDebug from 'debug';
import { isMagentoApiError, type MagentoApiError } from '../core/errors.js';

const debug = createDebug('reactionary:magento:errors');

/** The core typed errors a Magento failure is mapped onto. */
export type MagentoProviderError = NotFoundError | InvalidInputError | GenericError;

/** GraphQL `extensions.category` values Magento uses for missing entities. */
const NOT_FOUND_CATEGORIES = ['graphql-no-such-entity'];
/** GraphQL `extensions.category` values Magento uses for rejected input. */
const INVALID_INPUT_CATEGORIES = ['graphql-input', 'graphql-already-exists'];

function describe(err: unknown): string {
  if (isMagentoApiError(err)) {
    const graphqlMessages = err.graphqlErrors.map((e) => e.message).join('; ');
    return err.magentoMessage || graphqlMessages || err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === 'string' && err) {
    return err;
  }
  return 'Unknown error';
}

function isNotFound(err: MagentoApiError): boolean {
  return (
    err.status === 404 ||
    NOT_FOUND_CATEGORIES.some((category) => err.hasCategory(category))
  );
}

function isInvalidInput(err: MagentoApiError): boolean {
  return (
    err.status === 400 ||
    INVALID_INPUT_CATEGORIES.some((category) => err.hasCategory(category))
  );
}

/** True when the error is Magento reporting a missing entity (404 / `graphql-no-such-entity`). */
export function isMagentoNotFoundError(err: unknown): boolean {
  return isMagentoApiError(err) && isNotFound(err);
}

/**
 * Maps a caught failure onto a core typed error:
 * - 404 / `graphql-no-such-entity` → `NotFound` (carrying `identifier`);
 * - 400 / `graphql-input` / `graphql-already-exists` → `InvalidInput`;
 * - 401 / 403 / `graphql-authorization` and everything else → `Generic`.
 *
 * Auth failures deliberately stay `Generic`: there is no core error for them,
 * and reporting them as "not found" would hide a misconfigured token.
 */
export function toMagentoProviderError(
  action: string,
  err: unknown,
  identifier?: unknown,
): MagentoProviderError {
  const reason = describe(err);

  if (isMagentoApiError(err)) {
    if (isNotFound(err)) {
      return { type: 'NotFound', identifier };
    }
    if (isInvalidInput(err)) {
      return { type: 'InvalidInput', error: reason };
    }
  }

  return { type: 'Generic', message: `Failed to ${action}: ${reason}` };
}

/**
 * The Magento counterpart of medusa's `handleProviderError`: logs the
 * failure and, instead of throwing, returns it as a failed `Result` so a
 * capability can `return handleMagentoProviderError(...)` from its catch.
 *
 * The `Fail<NotFoundError>` return type fits any capability result whose
 * error type is `NotFoundError` or the default, since core's `Fail` always
 * admits `GenericError` and `InvalidInputError` too.
 */
export function handleMagentoProviderError(
  action: string,
  err: unknown,
  identifier?: unknown,
): Fail<NotFoundError> {
  if (debug.enabled) {
    debug(`Failed to ${action}: %O`, err);
  }
  const failure = error<MagentoProviderError>(
    toMagentoProviderError(action, err, identifier),
  );
  // Rebuilt field by field: TypeScript compares `Fail<A>` to `Fail<B>` by
  // their type arguments alone, although every `MagentoProviderError` already
  // fits `Fail<NotFoundError>['error']`.
  return { success: false, error: failure.error, meta: failure.meta };
}
