import { Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { ElrondApiService, RedisCacheService } from 'src/common';
import { AssetsQuery } from '../assets/assets-query';
import { BaseCollectionsAssetsRedisHandler } from './base-collection-assets.redis-handler';

@Injectable()
export class CollectionsNftsCountRedisHandler extends BaseCollectionsAssetsRedisHandler {
  protected redisClient: Redis.Redis;
  protected redisCacheService: RedisCacheService;
  constructor(
    redisCacheService: RedisCacheService,
    private apiService: ElrondApiService,
  ) {
    super(redisCacheService, 'collectionAssetsCount');
  }
  mapValues(returnValues: { key: string; value: any }[], data: any) {
    returnValues.forEach((item) => {
      if (item.value === null) item.value = data[item.key][0];
    });

    return returnValues.map((item) => {
      return item.value || 0;
    });
  }

  async getData(keys: string[]) {
    const getCountPromises = keys.map((identifier) =>
      this.apiService.getNftsCountForCollection(
        this.getQueryForCollection(identifier),
        identifier,
      ),
    );

    const nftsCountResponse = await Promise.all(getCountPromises);
    return nftsCountResponse?.groupBy((item) => item.collection);
  }

  private getQueryForCollection(identifier: string): string {
    return new AssetsQuery().addCollection(identifier).build();
  }
}
