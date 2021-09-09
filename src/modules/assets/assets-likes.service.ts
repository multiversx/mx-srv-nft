import { Inject, Injectable } from '@nestjs/common';
import { AssetLikeEntity } from 'src/db/assets/assets-likes.entity';
import { AssetsLikesRepository } from 'src/db/assets/assets-likes.repository';
import '../../utils/extentions';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisCacheService } from 'src/common/services/redis-cache.service';
import * as Redis from 'ioredis';
import { generateCacheKeyFromParams } from 'src/utils/generate-cache-key';
import { cacheConfig } from 'src/config';
import { AssetLikesProvider } from './asset-likes.loader';

@Injectable()
export class AssetsLikesService {
  private redisClient: Redis.Redis;
  constructor(
    private assetsLikesRepository: AssetsLikesRepository,
    private assetsLikeProvider: AssetLikesProvider,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private redisCacheService: RedisCacheService,
  ) {
    this.redisClient = this.redisCacheService.getClient(
      cacheConfig.followersRedisClientName,
    );
  }

  getAssetLikesCount(identifier: string): Promise<number> {
    try {
      const cacheKey = this.getAssetLikesCountCacheKey(identifier);
      const getAssetLikes = () =>
        this.assetsLikesRepository.getAssetLikesCount(identifier);
      return this.redisCacheService.getOrSet(
        this.redisClient,
        cacheKey,
        getAssetLikes,
        cacheConfig.assetsttl,
      );
    } catch (err) {
      this.logger.error(
        "An error occurred while loading asset's likes count.",
        {
          path: 'AssetsService.getAssetLikesCount',
          identifier,
        },
      );
    }
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
        cacheConfig.followersttl,
      );
    } catch (err) {
      this.logger.error("An error occurred while loading asset's liked.", {
        path: 'AssetsService.getAssetLiked',
        address,
      });
    }
  }

  isAssetLiked(identifier: string, address: string): Promise<boolean> {
    try {
      const cacheKey = this.getAssetLikedCacheKey(identifier, address);
      const getIsAssetLiked = () =>
        this.assetsLikesRepository.isAssetLiked(identifier, address);
      return this.redisCacheService.getOrSet(
        this.redisClient,
        cacheKey,
        getIsAssetLiked,
        cacheConfig.followersttl,
      );
    } catch (err) {
      this.logger.error('An error occurred while checking if asset is liked.', {
        path: 'AssetsService.isAssetLiked',
        identifier,
        address,
      });
      return Promise.resolve(false);
    }
  }

  async addLike(identifier: string, address: string): Promise<boolean> {
    try {
      await this.saveAssetLikeEntity(identifier, address);
      await this.invalidateCache(identifier, address);
      return await this.assetsLikesRepository.isAssetLiked(identifier, address);
    } catch (err) {
      this.logger.error('An error occurred while adding Asset Like.', {
        path: 'AssetsService.addLike',
        identifier,
        address,
        err,
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
        err,
      });
      return await this.assetsLikesRepository.isAssetLiked(identifier, address);
    }
  }

  private getAssetLikesCountCacheKey(identifier: string) {
    return generateCacheKeyFromParams('assetLikesCount', identifier);
  }

  private getAssetLikedByCacheKey(filters) {
    return generateCacheKeyFromParams('assetLiked', filters);
  }

  private async invalidateCache(
    identifier: string,
    address: string,
  ): Promise<void> {
    await this.assetsLikeProvider.clearKey(identifier);
    await this.invalidateAssetLikeCache(identifier, address);
    await this.invalidateAssetLikedByCount(address);
    await this.invalidateAssetLikesCount(identifier);
  }

  private invalidateAssetLikedByCount(address: string): Promise<void> {
    const cacheKey = this.getAssetLikedByCacheKey(address);
    return this.redisCacheService.del(this.redisClient, cacheKey);
  }

  private invalidateAssetLikesCount(identifier: string): Promise<void> {
    const cacheKey = this.getAssetLikesCountCacheKey(identifier);
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
