import { Inject, Injectable } from '@nestjs/common';
import '../../utils/extentions';
import { AssetLikeEntity, AssetsLikesRepository } from 'src/db/assets';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisCacheService } from 'src/common';
import * as Redis from 'ioredis';
import { generateCacheKeyFromParams } from 'src/utils/generate-cache-key';
import { cacheConfig } from 'src/config';
import { AssetLikesProvider } from './loaders/asset-likes-count.loader';
import { IsAssetLikedProvider } from './loaders/asset-is-liked.loader';

@Injectable()
export class AssetsLikesService {
  private redisClient: Redis.Redis;
  constructor(
    private assetsLikesRepository: AssetsLikesRepository,
    private assetsLikeProvider: AssetLikesProvider,
    private isAssetLikedLikeProvider: IsAssetLikedProvider,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private redisCacheService: RedisCacheService,
  ) {
    this.redisClient = this.redisCacheService.getClient(
      cacheConfig.assetsRedisClientName,
    );
  }

  getAssetLiked(
    limit: number = 50,
    offset: number,
    address: string,
  ): Promise<[AssetLikeEntity[], number]> {
    try {
      const cacheKey = this.getAssetLikedByCacheKey(address);
      const getAssetLiked = () =>
        this.assetsLikesRepository.getAssetsLiked(limit, offset, address);
      return this.redisCacheService.getOrSet(
        this.redisClient,
        cacheKey,
        getAssetLiked,
        cacheConfig.assetsttl,
      );
    } catch (err) {
      this.logger.error("An error occurred while loading asset's liked.", {
        path: 'AssetsService.getAssetLiked',
        address,
        exception: err,
      });
    }
  }

  async addLike(identifier: string, address: string): Promise<boolean> {
    try {
      const isLiked = await this.assetsLikesRepository.isAssetLiked(
        identifier,
        address,
      );
      if (isLiked) {
        return true;
      } else {
        await this.saveAssetLikeEntity(identifier, address);
        await this.invalidateCache(identifier, address);
        return true;
      }
    } catch (err) {
      this.logger.error('An error occurred while adding Asset Like.', {
        path: 'AssetsService.addLike',
        identifier,
        address,
        exception: err,
      });
      return await this.assetsLikesRepository.isAssetLiked(identifier, address);
    }
  }

  async removeLike(identifier: string, address: string): Promise<any> {
    try {
      await this.assetsLikesRepository.removeLike(identifier, address);
      await this.invalidateCache(identifier, address);
      return await this.assetsLikesRepository.isAssetLiked(identifier, address);
    } catch (err) {
      this.logger.error('An error occurred while removing Asset Like.', {
        path: 'AssetsService.removeLike',
        identifier,
        address,
        exception: err,
      });
      return await this.assetsLikesRepository.isAssetLiked(identifier, address);
    }
  }

  private getAssetLikedByCacheKey(filters) {
    return generateCacheKeyFromParams('assetLiked', filters);
  }

  private async invalidateCache(
    identifier: string,
    address: string,
  ): Promise<void> {
    await this.assetsLikeProvider.clearKey(identifier);
    await this.isAssetLikedLikeProvider.clearKey(`${identifier}_${address}`);
    await this.invalidateAssetLikeCache(identifier, address);
    await this.invalidateAssetLikedByCount(address);
  }

  private invalidateAssetLikedByCount(address: string): Promise<void> {
    const cacheKey = this.getAssetLikedByCacheKey(address);
    return this.redisCacheService.del(this.redisClient, cacheKey);
  }

  private invalidateAssetLikeCache(
    identifier: string,
    address: string,
  ): Promise<void> {
    const cacheKey = this.getAssetLikedCacheKey(identifier, address);
    return this.redisCacheService.del(this.redisClient, cacheKey);
  }

  private getAssetLikedCacheKey(identifier: string, address: string) {
    return generateCacheKeyFromParams('isAssetLiked', identifier, address);
  }

  private saveAssetLikeEntity(
    identifier: string,
    address: string,
  ): Promise<any> {
    const assetLikeEntity = this.buildAssetLikeEntity(identifier, address);
    return this.assetsLikesRepository.addLike(assetLikeEntity);
  }

  private buildAssetLikeEntity(
    identifier: string,
    address: string,
  ): AssetLikeEntity {
    return new AssetLikeEntity({
      identifier,
      address,
    });
  }
}
