import { BaseProvider, Client, Session } from '@reactionary/core';

/**
 * Extract all method names from a provider that follow the expected pattern
 */
export type ProviderMethods<T> = T extends BaseProvider 
  ? {
      [K in keyof T]: T[K] extends (...args: any[]) => any 
        ? K extends `get${string}` | `query${string}` | `add` | `remove` | `changeQuantity` | `login` | `logout` | `getSelf`
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
 * Introspect a client instance to extract all provider methods
 */
export function introspectClient<T extends Partial<Client>>(client: T): MethodInfo[] {
  const methods: MethodInfo[] = [];
  
  for (const [providerName, provider] of Object.entries(client)) {
    if (provider instanceof BaseProvider) {
      // Get all method names from the provider instance
      const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(provider))
        .filter(name => {
          const method = (provider as any)[name];
          return typeof method === 'function' && 
                 name !== 'constructor' &&
                 !name.startsWith('_') && // Skip private methods
                 (isQueryMethod(name) || isMutationMethod(name));
        });
      
      for (const methodName of methodNames) {
        const method = (provider as any)[methodName].bind(provider);
        
        methods.push({
          name: methodName,
          providerName,
          isQuery: isQueryMethod(methodName),
          isMutation: isMutationMethod(methodName),
          method
        });
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
export type ExtractPayloadType<T> = T extends (payload: infer P, session: Session) => any 
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
export type TRPCMethodSignature<T> = T extends (payload: infer P, session: Session) => infer R
  ? (input: TRPCMethodInput<P>) => R
  : T extends (payload: infer P) => infer R
  ? (input: TRPCMethodInput<P>) => R  
  : never;