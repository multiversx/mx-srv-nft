import { CacheModule, Module } from '@nestjs/common';
import { ElrondCommunicationModule } from '../../common/services/elrond-communication/elrond-communication.module';
import { CacheManagerModule } from '../../common/services/cache-manager/cache-manager.module';
import * as redisStore from 'cache-manager-redis-store';
import { AuctionsService } from './auctions.service';
import { AuctionsResolver } from './auctions.resolver';

@Module({
  providers: [AuctionsService, AuctionsResolver],
  imports: [
    ElrondCommunicationModule,
    CacheManagerModule,
    CacheModule.register({
      ttl: 30, // default cache to 30 seconds. it will be overridden when needed
      store: redisStore,
      host: process.env.REDIS_URL,
      port: process.env.REDIS_PORT,
      prefix: process.env.REDIS_PREFIX,
    }),
  ],
  exports: [AuctionsService],
})
export class AuctionsModuleGraph {}
