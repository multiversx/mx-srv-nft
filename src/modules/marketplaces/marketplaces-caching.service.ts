import { Inject, Injectable } from '@nestjs/common';
import '../../utils/extentions';
import * as Redis from 'ioredis';
import { cacheConfig } from 'src/config';
import { CachingService } from 'src/common/services/caching/caching.service';
import { CollectionType } from '../assets/models/Collection.type';
import { CacheInfo } from 'src/common/services/caching/entities/cache.info';
import { TimeConstants } from 'src/utils/time-utils';
import { Marketplace } from './models';

@Injectable()
export class MarketplacesCachingService {
  private redisClient: Redis.Redis;
  constructor(private cacheService: CachingService) {
    this.redisClient = this.cacheService.getClient(
      cacheConfig.persistentRedisClientName,
    );
  }

  public async getAllMarketplaces(
    getMarketplaces: () => any,
  ): Promise<CollectionType<Marketplace>> {
    return await this.cacheService.getOrSetCache(
      this.redisClient,
      CacheInfo.AllMarketplaces.key,
      () => getMarketplaces(),
      TimeConstants.oneHour,
    );
  }

  public async invalidateCache() {
    await this.cacheService.deleteInCache(
      this.redisClient,
      CacheInfo.Campaigns.key,
    );
  }
}
