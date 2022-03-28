import { forwardRef, Module } from '@nestjs/common';
import { CommonModule } from 'src/common.module';
import { AuctionsModuleGraph } from 'src/modules/auctions/auctions.module';
import { CollectionsNftsCountRedisHandler } from 'src/modules/nftCollections/collection-nfts-count.redis-handler';
import { CollectionsNftsRedisHandler } from 'src/modules/nftCollections/collection-nfts.redis-handler';
import { CollectionsService } from 'src/modules/nftCollections/collection.service';
import { PubSubListenerModule } from 'src/pubsub/pub.sub.listener.module';
import { AuctionsWarmerService } from './auction.warmer.service';
import { CacheWarmerService } from './cache.warmer.service';

@Module({
  imports: [
    CommonModule,
    forwardRef(() => AuctionsModuleGraph),
    PubSubListenerModule,
  ],
  providers: [
    CollectionsService,
    CollectionsNftsCountRedisHandler,
    CollectionsNftsRedisHandler,
    CacheWarmerService,
    AuctionsWarmerService,
  ],
  exports: [CommonModule],
})
export class CacheWarmerModule {}
