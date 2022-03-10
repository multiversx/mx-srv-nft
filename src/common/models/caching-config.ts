/**
 * Caching times expressed in seconds
 */
export class CachingConfig {
  auctionsRedisClientName: string;
  auctionsDbName: number;
  assetsRedisClientName: string;
  assetsDbName: number;
  ordersRedisClientName: string;
  ordersDbName: number;
  followersDbName: number;
  followersRedisClientName: string;
  collectionsDbName: number;
  collectionsRedisClientName: string;

  // network config and network status
  networkConfig: number;
  networkStatus: number;
}
