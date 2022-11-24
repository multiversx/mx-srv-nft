import { Injectable, Logger } from '@nestjs/common';
import {
  AuctionsGetterService,
  AuctionsSetterService,
} from 'src/modules/auctions';
import { AuctionStatusEnum } from 'src/modules/auctions/models';
import { MarketplacesService } from 'src/modules/marketplaces/marketplaces.service';
import { Marketplace } from 'src/modules/marketplaces/models';
import { MarketplaceTypeEnum } from 'src/modules/marketplaces/models/MarketplaceType.enum';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { CreateOrderArgs, OrderStatusEnum } from 'src/modules/orders/models';
import { OrdersService } from 'src/modules/orders/order.service';
import { ELRONDNFTSWAP_KEY } from 'src/utils/constants';
import { BidEvent } from '../../entities/auction';
import { ElrondSwapBidEvent } from '../../entities/auction/elrondnftswap/elrondswap-bid.event';
import { FeedEventsSenderService } from '../feed-events.service';

@Injectable()
export class BidEventHandler {
  private readonly logger = new Logger(BidEventHandler.name);
  constructor(
    private auctionsGetterService: AuctionsGetterService,
    private auctionsService: AuctionsSetterService,
    private ordersService: OrdersService,
    private notificationsService: NotificationsService,
    private feedEventsSenderService: FeedEventsSenderService,
    private readonly marketplaceService: MarketplacesService,
  ) {}

  async handle(event: any, hash: string, marketplaceType: MarketplaceTypeEnum) {
    let [bidEvent, topics] = [undefined, undefined];
    let bidMarketplace: Marketplace;
    if (marketplaceType === MarketplaceTypeEnum.External) {
      bidMarketplace = await this.marketplaceService.getMarketplaceByAddress(
        event.address,
      );
      [bidEvent, topics] = this.getEventAndTopics(event, bidMarketplace.key);
    } else {
      [bidEvent, topics] = this.getEventAndTopics(event);
      bidMarketplace = await this.marketplaceService.getMarketplaceByType(
        bidEvent.getAddress(),
        marketplaceType,
        topics.collection,
      );
    }
    if (!bidMarketplace) return;
    this.logger.log(
      `Bid event detected for hash '${hash}' and marketplace '${bidMarketplace?.name}'`,
    );
    const auction =
      await this.auctionsGetterService.getAuctionByIdAndMarketplace(
        parseInt(topics.auctionId, 16),
        bidMarketplace.key,
      );
    if (!auction) return;

    const activeOrder = await this.ordersService.getActiveOrderForAuction(
      auction.id,
    );
    if (activeOrder && activeOrder.priceAmount === topics.currentBid) {
      return;
    }

    const order = await this.ordersService.updateAuctionOrders(
      new CreateOrderArgs({
        ownerAddress: topics.currentWinner,
        auctionId: auction.id,
        priceToken: auction.paymentToken,
        priceAmount: topics.currentBid,
        priceNonce: auction.paymentNonce,
        blockHash: hash,
        status: OrderStatusEnum.Active,
        marketplaceKey: bidMarketplace.key,
      }),
      activeOrder,
    );
    await this.feedEventsSenderService.sendBidEvent(auction, topics, order);
    if (auction.maxBidDenominated === order.priceAmountDenominated) {
      this.notificationsService.updateNotificationStatus([auction?.id]);
      this.notificationsService.addNotifications(auction, order);
      this.auctionsService.updateAuctionStatus(
        auction.id,
        marketplaceType === MarketplaceTypeEnum.Internal
          ? AuctionStatusEnum.Claimable
          : AuctionStatusEnum.Ended,
        hash,
        event.identifier,
      );
    }
  }

  private getEventAndTopics(event: any, marketplaceKey?: string) {
    if (marketplaceKey && marketplaceKey === ELRONDNFTSWAP_KEY) {
      const bidEvent = new ElrondSwapBidEvent(event);
      const topics = bidEvent.getTopics();
      return [bidEvent, topics];
    }
    const bidEvent = new BidEvent(event);
    const topics = bidEvent.getTopics();
    return [bidEvent, topics];
  }
}