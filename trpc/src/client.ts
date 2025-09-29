import { Client, Session } from '@reactionary/core';
import type { TransparentClient } from './types';

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
 * const product = await client.product.getById({ id: '123' }, reqCtx);
 * ```
 */
export function createTRPCClient<TOriginalClient extends Partial<Client>>(
  trpcClient: any,
  options: TRPCClientOptions = {}
): TransparentClient<TOriginalClient> {
  const { defaultSession, autoSession = false } = options;

  return new Proxy({} as TransparentClient<TOriginalClient>, {
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

          // Only expose methods that are marked with TRPC decorators
          // This eliminates the need to filter TRPC-specific properties
          return async (payload: any, reqCtxArg?: Session) => {
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

            // Use decorator metadata to determine if this is a query or mutation
            // Note: We can't directly check the original provider here since we only have
            // the TRPC client, so we'll fall back to the router's procedure type detection
            if (trpcMethod?.query) {
              return await trpcMethod.query(input);
            } else if (trpcMethod?.mutate) {
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
 * const client = createTRPCClientWithSessionProvider(trpc, reqCtxProvider);
 *
 * // Session is automatically provided, fully typed
 * const product = await client.product.getById({ id: '123' });
 * ```
 */
export function createTRPCClientWithSessionProvider<TOriginalClient extends Partial<Client>>(
  trpcClient: any,
  sessionProvider: SessionProvider
): TransparentClient<TOriginalClient> {
  return new Proxy({} as TransparentClient<TOriginalClient>, {
    get(target, providerName: string | symbol) {
      if (typeof providerName !== 'string') {
        return undefined;
      }

      return new Proxy({}, {
        get(providerTarget, methodName: string | symbol) {
          if (typeof methodName !== 'string') {
            return undefined;
          }

          return async (payload: any, reqCtxArg?: Session) => {
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

            // Use TRPC client's procedure type detection
            if (trpcMethod?.query) {
              return await trpcMethod.query(input);
            } else if (trpcMethod?.mutate) {
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
