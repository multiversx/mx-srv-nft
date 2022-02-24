import { forwardRef, Module } from '@nestjs/common';
import {
  AssetsService,
  AssetsResolver,
  AssetsLikesService,
  AssetAuctionsCountProvider,
} from '.';
import { IpfsModule } from '../ipfs/ipfs.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsLikesRepository } from 'src/db/assets';
import { S3Service } from '../s3/s3.service';
import { AuctionsModuleGraph } from '../auctions/auctions.module';
import { ElrondCommunicationModule, RedisCacheService } from 'src/common';
import { AuctionsModuleDb } from 'src/db/auctions/auctions.module.db';
import { AssetAvailableTokensCountProvider } from './loaders/asset-available-tokens-count.loader';
import { AssetsSupplyLoader } from './loaders/assets-supply.loader';
import { AssetScamInfoProvider } from './loaders/assets-scam-info.loader';
import { IsAssetLikedProvider } from './loaders/asset-is-liked.loader';
import { ContentValidation } from './content.validation.service';
import { AssetAuctionResolver } from './asset-auction.resolver';
import { LowestAuctionProvider } from '../auctions/loaders/lowest-auctions.loader';
import { VerifyContentService } from './verify-content.service';
import { AssetAvailableTokensCountRedisHandler } from './loaders/asset-available-tokens-count.redis-handler';
import { IsAssetLikedRedisHandler } from './loaders/asset-is-liked.redis-handler';
import { AssetLikesProvider } from './loaders/asset-likes-count.loader';
import { AssetLikesProviderRedisHandler } from './loaders/asset-likes-count.redis-handler';
import { LowestAuctionRedisHandler } from '../auctions/loaders/lowest-auctions.redis-handler';
import { AssetsSupplyRedisHandler } from './loaders/assets-supply.redis-handler';
import { AssetScamInfoRedisHandler } from './loaders/assets-scam-info.redis-handler';
import { AssetAuctionsCountRedisHandler } from './loaders/asset-auctions-count.redis-handler';
import { AccountsProvider } from '../account-stats/loaders/accounts.loader';
import { AccountsRedisHandler } from '../account-stats/loaders/accounts.redis-handler';

@Module({
  providers: [
    AssetsService,
    AssetsLikesService,
    VerifyContentService,
    ContentValidation,
    AssetLikesProviderRedisHandler,
    AssetLikesProvider,
    IsAssetLikedRedisHandler,
    IsAssetLikedProvider,
    LowestAuctionRedisHandler,
    LowestAuctionProvider,
    AssetsSupplyRedisHandler,
    AssetsSupplyLoader,
    AssetAuctionsCountRedisHandler,
    AssetAuctionsCountProvider,
    AssetScamInfoRedisHandler,
    AssetScamInfoProvider,
    AssetAvailableTokensCountRedisHandler,
    AssetAvailableTokensCountProvider,
    AssetsResolver,
    AssetAuctionResolver,
    RedisCacheService,
    S3Service,
    AccountsProvider,
    AccountsRedisHandler,
  ],
  imports: [
    ElrondCommunicationModule,
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
    AssetsSupplyLoader,
    AssetScamInfoProvider,
  ],
})
export class AssetsModuleGraph {}
