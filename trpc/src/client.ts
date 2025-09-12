import { Client, Session } from '@reactionary/core';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { TRPCClientError } from '@trpc/client';

/**
 * Configuration options for TRPC client creation
 */
export interface TRPCClientOptions {
  /** Default session to use if not provided in method calls */
  defaultSession?: Session;
  /** Whether to automatically provide session from defaultSession */
  autoSession?: boolean;
}

/**
 * Create a type-safe client proxy that uses the original client's type interface
 * while routing all calls through TRPC
 * 
 * @example
 * ```typescript
 * import { createTRPCProxyClient } from '@trpc/client';
 * import { createTRPCClient } from '@reactionary/trpc/client';
 * 
 * const trpc = createTRPCProxyClient<AppRouter>({
 *   url: 'http://localhost:3000',
 * });
 * 
 * // Pass the original client type as the generic parameter
 * const client = createTRPCClient<typeof serverClient>(trpc, {
 *   defaultSession: mySession,
 *   autoSession: true
 * });
 * 
 * // Fully typed using the original client interface!
 * const product = await client.product.getById({ id: '123' }, session);
 * ```
 */
export function createTRPCClient<TOriginalClient extends Partial<Client>>(
  trpcClient: any,
  options: TRPCClientOptions = {}
): TOriginalClient {
  const { defaultSession, autoSession = false } = options;
  
  return new Proxy({} as TOriginalClient, {
    get(target, providerName: string | symbol) {
      if (typeof providerName !== 'string') {
        return undefined;
      }
      
      // Return a typed proxy for the provider that intercepts method calls
      return new Proxy({}, {
        get(providerTarget, methodName: string | symbol) {
          if (typeof methodName !== 'string') {
            return undefined;
          }
          
          // Filter out TRPC-specific properties that aren't actual provider methods
          if (methodName === 'schema' || methodName === '_def' || methodName.startsWith('_')) {
            return undefined;
          }
          
          // Don't check if provider/method exist in TRPC client - TRPC uses lazy proxies
          
          // Return a function that routes through TRPC
          return async (payload: any, sessionArg?: Session) => {
            // Determine session to use
            let session = sessionArg;
            if (!session && autoSession && defaultSession) {
              session = defaultSession;
            }
            
            // Prepare input for TRPC call
            const input = {
              payload,
              session
            };
            
            // Access TRPC provider and method lazily 
            const trpcProvider = trpcClient[providerName];
            const trpcMethod = trpcProvider[methodName];
            
            // TRPC proxy client methods have .query() and .mutate() properties
            // Use method naming convention to determine which to use
            const isQuery = methodName.startsWith('get') || methodName.startsWith('query') || methodName === 'getSelf';
            
            if (isQuery && trpcMethod?.query) {
              return await trpcMethod.query(input);
            } else if (!isQuery && trpcMethod?.mutate) {
              return await trpcMethod.mutate(input);
            } else {
              throw new Error(`Method ${String(providerName)}.${String(methodName)} not found on TRPC client`);
            }
          };
        }
      });
    }
  });
}

/**
 * Session provider interface for dependency injection
 */
export interface SessionProvider {
  getSession(): Promise<Session> | Session;
}

/**
 * Create a TRPC client with session provider for automatic session management
 * 
 * @example
 * ```typescript
 * const sessionProvider: SessionProvider = {
 *   getSession: () => getCurrentUserSession()
 * };
 * 
 * const client = createTRPCClientWithSessionProvider(trpc, sessionProvider);
 * 
 * // Session is automatically provided, fully typed
 * const product = await client.product.getById({ id: '123' });
 * ```
 */
export function createTRPCClientWithSessionProvider<TOriginalClient extends Partial<Client>>(
  trpcClient: any,
  sessionProvider: SessionProvider
): TOriginalClient {
  return new Proxy({} as TOriginalClient, {
    get(target, providerName: string | symbol) {
      if (typeof providerName !== 'string') {
        return undefined;
      }
      
      return new Proxy({}, {
        get(providerTarget, methodName: string | symbol) {
          if (typeof methodName !== 'string') {
            return undefined;
          }
          
          // Filter out TRPC-specific properties that aren't actual provider methods
          if (methodName === 'schema' || methodName === '_def' || methodName.startsWith('_')) {
            return undefined;
          }
          
          return async (payload: any, sessionArg?: Session) => {
            // If no session provided, get from provider
            let session = sessionArg;
            if (!session) {
              session = await sessionProvider.getSession();
            }
            
            const input = {
              payload,
              session
            };
            
            // Access TRPC provider and method lazily
            const trpcProvider = trpcClient[providerName];
            const trpcMethod = trpcProvider[methodName];
            
            // TRPC proxy client methods have .query() and .mutate() properties
            // Use method naming convention to determine which to use
            const isQuery = methodName.startsWith('get') || methodName.startsWith('query') || methodName === 'getSelf';
            
            if (isQuery && trpcMethod?.query) {
              return await trpcMethod.query(input);
            } else if (!isQuery && trpcMethod?.mutate) {
              return await trpcMethod.mutate(input);
            } else {
              throw new Error(`Method ${String(providerName)}.${String(methodName)} not found on TRPC client`);
            }
          };
        }
      });
    }
  });
}

/**
 * Type alias for creating typed TRPC clients
 * Use the original client type, not the router type
 * 
 * @example
 * ```typescript
 * type MyClient = typeof serverClient;
 * 
 * function useClient(): MyClient {
 *   return createTRPCClient<MyClient>(trpcProxyClient);
 * }
 * ```
 */
export type TRPCClientFromRouter<TOriginalClient> = TOriginalClient;