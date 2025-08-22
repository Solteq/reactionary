/**
 * Cache evaluation result that determines how and if a query should be cached
 */
export interface CacheEvaluation {
  /**
   * The cache key to use for storing/retrieving the value
   */
  key: string;
  
  /**
   * How long to cache the value in seconds
   */
  cacheDurationInSeconds: number;
  
  /**
   * Whether this query result can be cached
   */
  canCache: boolean;
}