import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/common';
import { AuctionEntity } from 'src/db/auctions';
import { RedisDataloaderHandler } from '../common/redis-dataloader.handler';

@Injectable()
export class LowestAuctionRedisHandler extends RedisDataloaderHandler<string> {
  constructor(redisCacheService: RedisCacheService) {
    super(redisCacheService, 'lowest_auctions', 30);
  }

  mapValues(
    identifiers: string[],
    auctionsIdentifiers: { [key: string]: AuctionEntity[] },
  ) {
    return identifiers?.map((identifier) =>
      auctionsIdentifiers[identifier] ? auctionsIdentifiers[identifier] : [],
    );
  }
}
