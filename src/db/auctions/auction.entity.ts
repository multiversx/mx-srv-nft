import BigNumber from 'bignumber.js';
import {
  AuctionTypeEnum,
  AuctionStatusEnum,
  AuctionAbi,
  ExternalAuctionAbi,
  ElrondSwapAuctionTypeEnum,
} from 'src/modules/auctions/models';
import { DateUtils } from 'src/utils/date-utils';
import denominate, { nominateVal } from 'src/utils/formatters';
import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../base-entity';
import { OrderEntity } from '../orders';
import { TagEntity } from './tags.entity';

@Entity('auctions')
@Unique('AuctionEntity_UQ_Marketplace', [
  'marketplaceAuctionId',
  'marketplaceKey',
])
export class AuctionEntity extends BaseEntity {
  @Column()
  marketplaceAuctionId: number;

  @Column({ length: 20 })
  @Index('auction_collection')
  collection: string;

  @Column()
  nrAuctionedTokens: number;

  @Column({ length: 30 })
  @Index()
  identifier: string;

  @Column()
  nonce: number;

  @Column({ length: 10 })
  @Index('auction_status')
  status: AuctionStatusEnum;

  @Column()
  type: AuctionTypeEnum;

  @Column({ length: 20 })
  @Index('auction_payment_token')
  paymentToken: string;

  @Column()
  paymentNonce: number;

  @Column({ length: 62 })
  @Index('auction_owner')
  ownerAddress: string;

  @Column()
  minBidDiff: string;

  @Column()
  minBid: string;

  @Column('decimal', { precision: 36, scale: 18, default: 0.0 })
  minBidDenominated: number;

  @Column()
  maxBid: string;

  @Column('decimal', { precision: 36, scale: 18, default: 0.0 })
  maxBidDenominated: number;

  @Column()
  @Index('auction_start_date')
  startDate: number;

  @Column()
  @Index('auction_end_date')
  endDate: number;

  @Column()
  tags: string;

  @Column({ length: 64 })
  blockHash: string;

  @Column({ length: 20 })
  @Index('auction_marketplace_key')
  marketplaceKey: string;

  @OneToMany(() => OrderEntity, (order) => order.auction)
  orders: OrderEntity[];
  @OneToMany(() => TagEntity, (tag) => tag.auction)
  tagEntities: TagEntity[];

  constructor(init?: Partial<AuctionEntity>) {
    super();
    Object.assign(this, init);
  }

  static fromAuctionAbi(
    auctionId: number,
    auction: AuctionAbi,
    tags: string,
    hash: string,
    marketplaceKey: string,
    decimals: number = 18,
  ) {
    if (!auction) {
      return null;
    }
    return new AuctionEntity({
      marketplaceAuctionId: auctionId,
      collection: auction.auctioned_tokens.token_identifier
        .valueOf()
        .toString(),
      nonce: parseInt(
        auction.auctioned_tokens.token_nonce.valueOf().toString(),
      ),
      nrAuctionedTokens: parseInt(
        auction.auctioned_tokens.amount.valueOf().toString(),
      ),
      status: AuctionStatusEnum.Running,
      type: AuctionTypeEnum[auction.auction_type.valueOf().name],
      paymentToken: auction.payment_token.valueOf().toString(),
      paymentNonce: parseInt(auction.payment_nonce.valueOf().toString()),
      ownerAddress: auction.original_owner.valueOf().toString(),
      minBid: auction.min_bid.valueOf().toString(),
      minBidDiff: auction.min_bid_diff.valueOf().toString(),
      minBidDenominated: new BigNumber(auction.min_bid.valueOf().toString())
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),
      maxBid: auction.max_bid?.valueOf()?.toString() || '0',
      maxBidDenominated: new BigNumber(
        auction.max_bid?.valueOf()?.toString() || '0',
      )
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),
      startDate: parseInt(auction.start_time.valueOf().toString()),
      endDate: parseInt(auction.deadline.valueOf().toString()),
      identifier: `${auction.auctioned_tokens.token_identifier
        .valueOf()
        .toString()}-${nominateVal(
        parseInt(auction.auctioned_tokens.token_nonce.valueOf().toString()),
      )}`,
      tags: tags ? `,${tags},` : '',
      blockHash: hash,
      marketplaceKey: marketplaceKey,
    });
  }

  static fromExternalAuctionAbi(
    auctionId: number,
    auction: ExternalAuctionAbi,
    tags: string,
    hash: string,
    marketplaceKey: string,
    decimals: number = 18,
  ) {
    if (!auction) return null;
    return new AuctionEntity({
      marketplaceAuctionId: auctionId,
      collection: auction.auctioned_token_type.toString(),
      nonce: parseInt(auction.auctioned_token_nonce.valueOf().toString()),
      nrAuctionedTokens: parseInt(
        auction.nr_auctioned_tokens.valueOf().toString(),
      ),
      status: AuctionStatusEnum.Running,
      type: AuctionTypeEnum[auction.auction_type.valueOf().name],
      paymentToken: auction.payment_token_type.toString(),
      paymentNonce: parseInt(auction.payment_token_nonce.valueOf().toString()),
      ownerAddress: auction.original_owner.valueOf().toString(),
      minBid: auction.min_bid.valueOf().toString(),
      // minBidDiff: auction.min_bid_diff.valueOf().toString(),
      minBidDenominated: new BigNumber(auction.min_bid.valueOf().toString())
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),
      maxBid: auction.max_bid?.valueOf()?.toString() || '0',
      maxBidDenominated: new BigNumber(
        auction.max_bid?.valueOf()?.toString() || '0',
      )
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),
      startDate: parseInt(auction.start_time.valueOf().toString()),
      endDate: parseInt(auction.deadline.valueOf().toString()),
      identifier: `${auction.auctioned_token_type.toString()}-${nominateVal(
        parseInt(auction.auctioned_token_nonce.valueOf().toString()),
      )}`,
      tags: tags ? `,${tags},` : '',
      blockHash: hash,
      marketplaceKey: marketplaceKey,
    });
  }

  static fromWithdrawTopics(
    topicsAuctionToken: {
      originalOwner: string;
      collection: string;
      nonce: string;
      auctionId: string;
      nrAuctionTokens: string;
      price: string;
      paymentToken: string;
      paymentTokenNonce: string;
      auctionType: string;
      deadline: number;
    },
    tags: string,
    hash: string,
    marketplaceKey: string,
    decimals: number = 18,
  ) {
    if (!topicsAuctionToken) {
      return null;
    }
    return new AuctionEntity({
      marketplaceAuctionId: parseInt(topicsAuctionToken.auctionId, 16),
      collection: topicsAuctionToken.collection,
      nonce: parseInt(topicsAuctionToken.nonce, 16),
      nrAuctionedTokens: parseInt(topicsAuctionToken.nrAuctionTokens, 16),
      status: AuctionStatusEnum.Running,
      type:
        topicsAuctionToken.auctionType === '' ||
        parseInt(topicsAuctionToken.auctionType) ===
          ElrondSwapAuctionTypeEnum.Auction
          ? AuctionTypeEnum.Nft
          : AuctionTypeEnum.SftOnePerPayment,
      paymentToken: topicsAuctionToken.paymentToken,
      paymentNonce: parseInt(topicsAuctionToken.paymentTokenNonce),
      ownerAddress: topicsAuctionToken.originalOwner,
      minBid: topicsAuctionToken.price,
      // minBidDiff: auction.min_bid_diff.valueOf().toString(),
      minBidDenominated: new BigNumber(topicsAuctionToken.price)
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),
      maxBid:
        parseInt(topicsAuctionToken.auctionType) ===
        ElrondSwapAuctionTypeEnum.Buy
          ? topicsAuctionToken.price
          : '0',
      maxBidDenominated: new BigNumber(
        parseInt(topicsAuctionToken.auctionType) ===
        ElrondSwapAuctionTypeEnum.Buy
          ? topicsAuctionToken.price
          : '0',
      )
        .dividedBy(Math.pow(10, decimals))
        .toNumber(),

      startDate: DateUtils.getCurrentTimestamp(),
      endDate: topicsAuctionToken.deadline,
      identifier: `${topicsAuctionToken.collection}-${topicsAuctionToken.nonce}`,
      tags: tags ? `,${tags},` : '',
      blockHash: hash,
      marketplaceKey: marketplaceKey,
    });
  }
}
