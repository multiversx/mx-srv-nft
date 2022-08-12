import { Inject, Injectable } from '@nestjs/common';
import { Auction, AuctionStatusEnum } from './models';
import '../../utils/extentions';
import { AuctionEntity } from 'src/db/auctions';
import { NftMarketplaceAbiService } from './nft-marketplace.abi.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as Redis from 'ioredis';
import { cacheConfig } from 'src/config';
import { RedisCacheService } from 'src/common';
import { AuctionsServiceDb } from 'src/db/auctions/auctions.service.db';
import { PerformanceProfiler } from '../metrics/performance.profiler';
import { MetricsCollector } from '../metrics/metrics.collector';
import { AuctionEventEnum } from '../assets/models';
import { TagEntity } from 'src/db/auctions/tags.entity';
import { TagsRepository } from 'src/db/auctions/tags.repository';
import { AssetByIdentifierService } from '../assets/asset-by-identifier.service';
import { MarketplacesService } from '../marketplaces/marketplaces.service';

@Injectable()
export class AuctionsSetterService {
  constructor(
    private nftAbiService: NftMarketplaceAbiService,
    private assetByIdentifierService: AssetByIdentifierService,
    private auctionServiceDb: AuctionsServiceDb,
    private marketplacesService: MarketplacesService,
    private tagsRepository: TagsRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async saveAuction(
    auctionId: number,
    identifier: string,
    marketplaceKey: string,
    marketplaceAddress: string,
    hash: string,
  ): Promise<AuctionEntity> {
    let profiler = new PerformanceProfiler();
    try {
      const auctionData = await this.nftAbiService.getAuctionQuery(
        marketplaceAddress,
        auctionId,
      );
      const asset = await this.assetByIdentifierService.getAsset(identifier);
      if (auctionData) {
        const savedAuction = await this.auctionServiceDb.insertAuction(
          AuctionEntity.fromAuctionAbi(
            auctionId,
            auctionData,
            asset?.tags?.toString(),
            hash,
            marketplaceKey,
          ),
        );

        if (asset?.tags) {
          let tags: TagEntity[] = [];
          for (const tag of asset?.tags) {
            tags = [
              ...tags,
              new TagEntity({ auctionId: savedAuction.id, tag: tag }),
            ];
          }

          await this.tagsRepository.saveTags(tags);
        }
        return savedAuction;
      }
      return;
    } catch (error) {
      this.logger.error('An error occurred while savind an auction', error, {
        path: 'AuctionsService.saveAuction',
        auctionId,
        exception: error,
      });
    } finally {
      profiler.stop();
      MetricsCollector.setAuctionEventsDuration(
        AuctionEventEnum.AuctionTokenEvent,
        profiler.duration,
      );
    }
  }

  async rollbackAuctionByHash(blockHash: string): Promise<boolean> {
    try {
      return await this.auctionServiceDb.rollbackAuctionAndOrdersByHash(
        blockHash,
      );
    } catch (error) {
      this.logger.error('An error occurred while rollback Auctions', {
        path: 'AuctionsService.rollbackAuctionByHash',
        blockHash,
        exception: error,
      });
    }
  }

  async updateAuction(
    id: number,
    status: AuctionStatusEnum,
    hash: string,
    auctionEvent: string,
  ): Promise<Auction | any> {
    let profiler = new PerformanceProfiler();
    try {
      return await this.auctionServiceDb.updateAuction(id, status, hash);
    } catch (error) {
      this.logger.error('An error occurred while updating auction', {
        path: 'AuctionsService.updateAuction',
        id,
        exception: error,
      });
    } finally {
      profiler.stop();
      MetricsCollector.setAuctionEventsDuration(
        auctionEvent,
        profiler.duration,
      );
    }
  }

  async updateAuctionByMarketplaceKey(
    id: number,
    marketplaceKey: string,
    status: AuctionStatusEnum,
    hash: string,
    auctionEvent: string,
  ): Promise<Auction | any> {
    let profiler = new PerformanceProfiler();
    try {
      return await this.auctionServiceDb.updateAuction(id, status, hash);
    } catch (error) {
      this.logger.error('An error occurred while updating auction', {
        path: 'AuctionsService.updateAuction',
        id,
        exception: error,
      });
    } finally {
      profiler.stop();
      MetricsCollector.setAuctionEventsDuration(
        auctionEvent,
        profiler.duration,
      );
    }
  }

  async updateAuctions(auctions: AuctionEntity[]): Promise<Auction | any> {
    return await this.auctionServiceDb.updateAuctions(auctions);
  }
}
