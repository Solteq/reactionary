import type { GenericError } from "./errors/generic.error.js";
import type { InvalidInputError } from "./errors/invalid-input.error.js";
import type { InvalidOutputError } from "./errors/invalid-output.error.js";

export type Ok<T> = {
  success: true;
  value: T;
};

export type Fail<E = Error> = {
  success: false;
  error: E | GenericError | InvalidInputError | InvalidOutputError;
};

export type Result<T, E = Error> = Ok<T> | Fail<E>;

/**
 * Utility function for asserting and unwrapping the value of a success.
 * It is an assert, so treat it as such (similar to any unwrap, assert or similar function).
 * You are guaranteeing that this will ALWAYS succeed, and can expect a runtime error if
 * that assertion ever fails.
 * 
 * This is primarily useful for cases where you KNOW that it shouldn't fail, or where failure
 * has no known mechanism of recovery besides simply crashing.
 */
export function assertSuccess<T, E = Error>(
  result: Result<T, E>
): asserts result is Ok<T> {
  if (!result.success) {
    throw new Error(
      `Expected Result.success = true, but got false. Error: ${result.error}`
    );
  }
}

/**
 * Utility function for asserting an error. This is primarily useful for testing scenarios
 * that trigger errors as part of their validation.
 */
export function assertError<T, E = Error>(
  result: Result<T, E>
): asserts result is Fail<E> {
  if (result.success) {
    throw new Error(`Expected failure but got success: ${result.value}`);
  }
}

/**
 * Utility function for unwrapping a value from a result. Internally this
 * WILL assert success, so the caller needs to guarantee that this will
 * always be a valid operation, or expect a thrown exception.
 */
export function unwrapValue<T, E = Error>(result: Result<T, E>): T {
  assertSuccess(result);
  return result.value;
}

/**
 * Utility function for unwrapping an error. Primarily useful for testing.
 */
export function unwrapError<T, E = Error>(
  result: Result<T, E>
): Fail<E>['error'] {
  assertError(result);
  return result.error;
}

export function success<T>(value: T): Ok<T> {
  return {
    success: true,
    value
  }
}

export function error<E>(error: E): Fail<E> {
  return {
    success: false,
    error
  }
}