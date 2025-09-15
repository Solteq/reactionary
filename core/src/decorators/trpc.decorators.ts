import 'reflect-metadata';

/**
 * Metadata keys for TRPC method decorators
 */
export const TRPC_QUERY_METADATA_KEY = Symbol('trpc:query');
export const TRPC_MUTATION_METADATA_KEY = Symbol('trpc:mutation');



/**
 * Options for TRPC method decorators
 */
export interface TRPCMethodOptions {
  /** Custom name for the TRPC procedure (defaults to method name) */
  name?: string;
  /** Description for documentation purposes */
  description?: string;
}

/**
 * Decorator to mark a provider method as a TRPC query procedure
 * Query procedures are read-only operations (GET-like)
 * 
 * @example
 * ```typescript
 * class ProductProvider extends BaseProvider {
 *   @trpcQuery()
 *   async getById(payload: ProductQueryById, session: Session): Promise<Product> {
 *     // implementation
 *   }
 * 
 *   @trpcQuery({ name: 'findBySlug', description: 'Find product by URL slug' })
 *   async getBySlug(payload: ProductQueryBySlug, session: Session): Promise<Product> {
 *     // implementation
 *   }
 * }
 * ```
 */
export function trpcQuery(options: TRPCMethodOptions = {}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata about this method being a TRPC query
    const metadata = {
      methodName: String(propertyKey),
      isQuery: true,
      isMutation: false,
      options
    };

    // Store on the prototype so it's inherited
    Reflect.defineMetadata(TRPC_QUERY_METADATA_KEY, metadata, target, propertyKey);
    
    // Also store a list of all TRPC methods on the class
    const existingMethods = Reflect.getMetadata(TRPC_QUERY_METADATA_KEY, target.constructor) || [];
    existingMethods.push({ propertyKey, metadata });
    Reflect.defineMetadata(TRPC_QUERY_METADATA_KEY, existingMethods, target.constructor);
  };
}

/**
 * Decorator to mark a provider method as a TRPC mutation procedure
 * Mutation procedures are write operations that modify state (POST/PUT/DELETE-like)
 * 
 * @example
 * ```typescript
 * class CartProvider extends BaseProvider {
 *   @trpcMutation()
 *   async add(payload: CartAddMutation, session: Session): Promise<Cart> {
 *     // implementation
 *   }
 * 
 *   @trpcMutation({ name: 'removeItem' })
 *   async remove(payload: CartRemoveMutation, session: Session): Promise<Cart> {
 *     // implementation  
 *   }
 * }
 * ```
 */
export function trpcMutation(options: TRPCMethodOptions = {}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata about this method being a TRPC mutation
    const metadata = {
      methodName: String(propertyKey),
      isQuery: false,
      isMutation: true,
      options
    };

    // Store on the prototype so it's inherited
    Reflect.defineMetadata(TRPC_MUTATION_METADATA_KEY, metadata, target, propertyKey);
    
    // Also store a list of all TRPC methods on the class
    const existingMethods = Reflect.getMetadata(TRPC_MUTATION_METADATA_KEY, target.constructor) || [];
    existingMethods.push({ propertyKey, metadata });
    Reflect.defineMetadata(TRPC_MUTATION_METADATA_KEY, existingMethods, target.constructor);
  };
}

/**
 * Get all TRPC query methods from a class or instance
 */
export function getTRPCQueryMethods(target: any): Array<{ propertyKey: string | symbol; metadata: any }> {
  const constructor = typeof target === 'function' ? target : target.constructor;
  return Reflect.getMetadata(TRPC_QUERY_METADATA_KEY, constructor) || [];
}

/**
 * Get all TRPC mutation methods from a class or instance
 */
export function getTRPCMutationMethods(target: any): Array<{ propertyKey: string | symbol; metadata: any }> {
  const constructor = typeof target === 'function' ? target : target.constructor;
  return Reflect.getMetadata(TRPC_MUTATION_METADATA_KEY, constructor) || [];
}

/**
 * Get all TRPC methods (both queries and mutations) from a class or instance
 */
export function getAllTRPCMethods(target: any): Array<{ propertyKey: string | symbol; metadata: any }> {
  return [
    ...getTRPCQueryMethods(target),
    ...getTRPCMutationMethods(target)
  ];
}

/**
 * Check if a method is marked as a TRPC query
 */
export function isTRPCQuery(target: any, methodName: string | symbol): boolean {
  return !!Reflect.getMetadata(TRPC_QUERY_METADATA_KEY, target, methodName);
}

/**
 * Check if a method is marked as a TRPC mutation
 */
export function isTRPCMutation(target: any, methodName: string | symbol): boolean {
  return !!Reflect.getMetadata(TRPC_MUTATION_METADATA_KEY, target, methodName);
}

/**
 * Check if a method is marked for TRPC exposure (query or mutation)
 */
export function isTRPCMethod(target: any, methodName: string | symbol): boolean {
  return isTRPCQuery(target, methodName) || isTRPCMutation(target, methodName);
}