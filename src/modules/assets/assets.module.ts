import { forwardRef, Module } from '@nestjs/common';
import { ElrondCommunicationModule } from '../../common/services/elrond-communication/elrond-communication.module';
import { AssetsService } from './assets.service';
import { AssetsResolver } from './assets.resolver';
import { IpfsModule } from '../ipfs/ipfs.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsLikesService } from './assets-likes.service';
import { RedisCacheService } from 'src/common/services/redis-cache.service';
import { AssetsLikesRepository } from 'src/db/assets/assets-likes.repository';
import { AssetsHistoryResolver } from './assets-history.resolver';
import { AssetsHistoryService } from './assets-history.service';
import { S3Service } from '../s3/s3.service';
import { AccountsModuleGraph } from '../accounts/accounts.module';
import { AuctionsModuleDb } from 'src/db/auctions/auctions.module';
import { AuctionsModuleGraph } from '../auctions/auctions.module';
import { AssetLikesProvider } from './asset-likes.loader';
import { DataServiceUSD } from '../data.service.usd';
import { AssetHistoryPriceResolver } from './asset-history-price.resolver';

@Module({
  providers: [
    AssetsService,
    AssetsLikesService,
    AssetLikesProvider,
    AssetsHistoryService,
    AssetsResolver,
    AssetsHistoryResolver,
    AssetHistoryPriceResolver,
    RedisCacheService,
    S3Service,
    DataServiceUSD,
  ],
  imports: [
    ElrondCommunicationModule,
    forwardRef(() => AccountsModuleGraph),
    forwardRef(() => AuctionsModuleDb),
    forwardRef(() => AuctionsModuleGraph),
    IpfsModule,
    TypeOrmModule.forFeature([AssetsLikesRepository]),
  ],
  exports: [
    AssetsService,
    AssetsLikesService,
    RedisCacheService,
    S3Service,
    AssetLikesProvider,
  ],
})
export class AssetsModuleGraph {}
