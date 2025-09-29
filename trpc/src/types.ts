import type {
  Client,
  RequestContext,
  Session} from '@reactionary/core';
import {
  BaseProvider
} from '@reactionary/core';

/**
 * Extract method names from a provider that match TRPC patterns
 */
export type ProviderMethods<T> = T extends BaseProvider
  ? {
      [K in keyof T]: T[K] extends (...args: any[]) => any
        ? K extends `get${string}` | `query${string}` | 'add' | 'remove' | 'changeQuantity' | 'login' | 'logout' | 'getSelf'
          ? K
          : never
        : never
    }[keyof T]
  : never;

/**
 * Extract method signature from a provider method
 */
export type ProviderMethodSignature<T, K extends keyof T> =
  T[K] extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : never;

/**
 * Map all methods of all providers in a client
 */
export type ClientMethodMap<T extends Partial<Client>> = {
  [K in keyof T]: T[K] extends BaseProvider
    ? {
        [M in ProviderMethods<T[K]>]: ProviderMethodSignature<T[K], M>
      }
    : never;
};


/**
 * Create transparent client that only includes methods matching TRPC patterns
 */
export type TransparentClient<T extends Partial<Client>> = {
  [K in keyof T]: T[K] extends BaseProvider
    ? {
        [M in ProviderMethods<T[K]>]: ProviderMethodSignature<T[K], M>
      }
    : never;
};

/**
 * Extract method information for TRPC procedure creation
 */
export interface MethodInfo {
  name: string;
  providerName: string;
  isQuery: boolean;
  isMutation: boolean;
  method: (...args: any[]) => any;
}


/**
 * Utility to determine if a method is a query or mutation based on naming convention
 */
export function isQueryMethod(methodName: string): boolean {
  return methodName.startsWith('get') ||
         methodName.startsWith('query') ||
         methodName === 'getSelf';
}

export function isMutationMethod(methodName: string): boolean {
  return !isQueryMethod(methodName) && (
    methodName === 'add' ||
    methodName === 'remove' ||
    methodName === 'changeQuantity' ||
    methodName === 'login' ||
    methodName === 'logout'
  );
}

/**
 * Introspect a client instance to extract all provider methods matching naming patterns
 */
export function introspectClient<T extends Partial<Client>>(client: T): MethodInfo[] {
  const methods: MethodInfo[] = [];

  for (const [providerName, provider] of Object.entries(client)) {
    if (provider instanceof BaseProvider) {
      // Get all methods that match our naming patterns
      for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(provider))) {
        const method = (provider as any)[key];
        if (typeof method === 'function' && key !== 'constructor') {
          if (isQueryMethod(key) || isMutationMethod(key)) {
            methods.push({
              name: key,
              providerName,
              isQuery: isQueryMethod(key),
              isMutation: isMutationMethod(key),
              method: method.bind(provider)
            });
          }
        }
      }
    }
  }

  return methods;
}

/**
 * Type for TRPC procedure input - includes payload and session
 */
export interface TRPCMethodInput<TPayload = any> {
  payload: TPayload;
  session?: Session;
}

/**
 * Helper to extract payload type from a provider method
 */
export type ExtractPayloadType<T> = T extends (payload: infer P, reqCtx: RequestContext) => any
  ? P
  : T extends (payload: infer P) => any
  ? P
  : never;

/**
 * Helper to extract return type from a provider method
 */
export type ExtractReturnType<T> = T extends (...args: any[]) => infer R
  ? R
  : never;

/**
 * Create a TRPC-compatible method signature from a provider method
 */
export type TRPCMethodSignature<T> = T extends (payload: infer P, reqCtx: RequestContext) => infer R
  ? (input: TRPCMethodInput<P>) => R
  : T extends (payload: infer P) => infer R
  ? (input: TRPCMethodInput<P>) => R
  : never;
