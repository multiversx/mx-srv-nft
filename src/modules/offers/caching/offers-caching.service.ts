import { Injectable } from '@nestjs/common';
import '../../../utils/extensions';
import { generateCacheKeyFromParams } from 'src/utils/generate-cache-key';
import { TimeConstants } from 'src/utils/time-utils';
import { OfferEntity } from 'src/db/offers';
import { RedisCacheService } from '@multiversx/sdk-nestjs';

@Injectable()
export class OffersCachingService {
  constructor(private redisCacheService: RedisCacheService) {}

  public async getOrSetOffersForAddress(
    address: string,
    getOrSetOffersForAddress: () => any,
  ): Promise<[OfferEntity[], number]> {
    return this.redisCacheService.getOrSet(
      this.getOffersForOwnerCacheKey(address),
      () => getOrSetOffersForAddress(),
      30 * TimeConstants.oneMinute,
    );
  }

  public async getOrSetOffersForCollection(
    address: string,
    getOrSetOffersForCollection: () => any,
  ): Promise<[OfferEntity[], number]> {
    return this.redisCacheService.getOrSet(
      this.getOffersForCollectionCacheKey(address),
      () => getOrSetOffersForCollection(),
      30 * TimeConstants.oneSecond,
    );
  }

  public async invalidateCache(
    collectionIdentifier?: string,
    ownerAddress?: string,
  ): Promise<void> {
    await this.redisCacheService.delete(
      this.getOffersForOwnerCacheKey(ownerAddress),
    );
    await this.redisCacheService.delete(
      this.getOffersForCollectionCacheKey(collectionIdentifier),
    );
  }

  private getOffersForOwnerCacheKey(address: string): string {
    return generateCacheKeyFromParams('offers_owner', address);
  }

  private getOffersForCollectionCacheKey(collection: string): string {
    return generateCacheKeyFromParams('offers_collection', collection);
  }
}
