import { Injectable, Logger } from '@nestjs/common';
import {
  ElrondApiService,
  ElrondElasticService,
  RedisCacheService,
} from 'src/common';
import { cacheConfig } from 'src/config';
import '../../utils/extensions';
import { AssetsLikesService } from './assets-likes.service';
import { AssetsQuery } from '.';
import { Asset, CollectionType } from './models';
import * as Redis from 'ioredis';
import { generateCacheKeyFromParams } from 'src/utils/generate-cache-key';
import { AssetScamInfoProvider } from './loaders/assets-scam-info.loader';
import { AssetsSupplyLoader } from './loaders/assets-supply.loader';
import { AssetsFilter, Sort } from '../common/filters/filtersTypes';
import { TimeConstants } from 'src/utils/time-utils';
import { AssetRarityInfoProvider } from './loaders/assets-rarity-info.loader';
import { AssetByIdentifierService } from './asset-by-identifier.service';
import * as hash from 'object-hash';
import { AssetsSortingEnum } from './models/Assets-Sorting.enum';
import { NftTraitsService } from '../nft-traits/nft-traits.service';
import { NftTrait } from '../nft-traits/models/nft-traits.model';
import { CollectionsGetterService } from '../nftCollections/collections-getter.service';
import {
  ElasticQuery,
  ElasticSortOrder,
  QueryConditionOptions,
  QueryOperator,
  QueryType,
} from '@elrondnetwork/erdnest';
import { QueryPagination } from 'src/common/services/elrond-communication/models/query-pagination';

@Injectable()
export class AssetsGetterService {
  private redisClient: Redis.Redis;
  constructor(
    private apiService: ElrondApiService,
    private collectionsService: CollectionsGetterService,
    private elasticService: ElrondElasticService,
    private assetByIdentifierService: AssetByIdentifierService,
    private assetScamLoader: AssetScamInfoProvider,
    private assetRarityLoader: AssetRarityInfoProvider,
    private assetSupplyLoader: AssetsSupplyLoader,
    private assetsLikedService: AssetsLikesService,
    private nftTraitsService: NftTraitsService,
    private readonly logger: Logger,
    private redisCacheService: RedisCacheService,
  ) {
    this.redisClient = this.redisCacheService.getClient(
      cacheConfig.persistentRedisClientName,
    );
  }

  async getAssetsForUser(
    address: string,
    query: string = '',
    countQuery: string = '',
  ): Promise<CollectionType<Asset>> {
    query = new AssetsQuery(query)
      .addQuery('includeFlagged=true&source=elastic')
      .build();
    countQuery = new AssetsQuery(countQuery)
      .addQuery('includeFlagged=true')
      .build();
    const [nfts, count] = await Promise.all([
      this.apiService.getNftsForUser(address, query),
      this.apiService.getNftsForUserCount(address, countQuery),
    ]);
    const assets = nfts?.map((element) => Asset.fromNft(element, address));
    return new CollectionType({ count, items: assets });
  }

  async getAssets(
    offset: number = 0,
    limit: number = 10,
    filters: AssetsFilter,
    sorting: AssetsSortingEnum,
  ): Promise<CollectionType<Asset>> {
    const apiQuery = filters?.ownerAddress
      ? this.getApiQueryWithoutOwnerFlag(filters, offset, limit)
      : this.getApiQuery(filters, offset, limit);
    const apiCountQuery = this.getApiQueryForCount(filters);

    if (sorting === AssetsSortingEnum.MostLikes) {
      const assets = await this.assetsLikedService.getMostLikedAssets();
      return new CollectionType({
        count: assets.length,
        items: assets.slice(offset, offset + limit),
      });
    }

    let sortByRank: Sort = undefined;
    if (sorting === AssetsSortingEnum.RankAsc) {
      sortByRank = Sort.ASC;
    } else if (sorting === AssetsSortingEnum.RankDesc) {
      sortByRank = Sort.DESC;
    }

    if (filters?.traits) {
      const response = await this.getCollectionAssetsByTraits(
        filters.collection,
        filters.traits,
        limit,
        offset,
        sortByRank,
      );
      this.addToCache(response);
      return response;
    }

    if (filters?.likedByAddress) {
      const response = await this.getlikedByAssets(
        filters.likedByAddress,
        limit,
        offset,
      );
      this.addToCache(response);
      return response;
    }

    if (filters?.artistAddress) {
      const response = await this.getAssetsByArtistAddress(
        filters.artistAddress,
        limit,
        offset,
      );
      this.addToCache(response);
      return response;
    }

    if (filters?.ownerAddress) {
      const response = await this.getAssetsByOwnerAddress(
        filters,
        apiQuery,
        apiCountQuery,
      );
      await this.addToCache(response);
      return new CollectionType({
        count: response?.count,
        items: response?.items?.map((a) => {
          return { ...a, ownerAddress: filters?.ownerAddress };
        }),
      });
    }

    const response = await this.getAssetsWithoutOwner(
      filters,
      apiQuery,
      apiCountQuery,
    );
    this.addToCache(response);
    return response;
  }

  async getAssetsForCollection(
    filters: AssetsFilter,
    limit: number = 4,
  ): Promise<[any[], number]> {
    const apiQuery = new AssetsQuery()
      .addCollection(filters?.collection)
      .addPageSize(0, limit)
      .build();

    return await this.getCollectionAssets(apiQuery);
  }

  async getAssetByIdentifierAndAddress(
    onwerAddress: string,
    identifier: string,
  ): Promise<Asset> {
    const nft = await this.apiService.getNftByIdentifierAndAddress(
      onwerAddress,
      identifier,
    );
    return Asset.fromNft(nft, onwerAddress);
  }

  async getAssetsForIdentifiers(identifiers: string[]): Promise<Asset[]> {
    const nfts = await this.apiService.getNftsByIdentifiers(identifiers);
    return nfts?.map((nft) => Asset.fromNft(nft));
  }

  private async getCollectionAssets(
    query: string = '',
  ): Promise<[any[], number]> {
    query = new AssetsQuery(query).addFields(['media', 'identifier']).build();
    const [nfts, count] = await Promise.all([
      this.apiService.getAllNfts(query),
      this.apiService.getNftsCount(query),
    ]);
    return [nfts, count];
  }

  private async getAllAssets(
    query: string = '',
    countQuery: string = '',
  ): Promise<CollectionType<Asset>> {
    query = new AssetsQuery(query).build();
    countQuery = new AssetsQuery(countQuery).build();
    const [nfts, count] = await Promise.all([
      this.apiService.getAllNfts(query),
      this.apiService.getNftsCount(countQuery),
    ]);
    if (!nfts || !count) {
      return null;
    }

    const assets = nfts?.map((element) => Asset.fromNft(element));

    // todo remove debug log
    console.log(assets.map((nft) => nft.rarity.rank));

    return new CollectionType({ count, items: assets });
  }

  private async getAssetsWithoutOwner(
    filters: AssetsFilter,
    query: string = '',
    countQuery: string = '',
  ): Promise<CollectionType<Asset>> {
    if (filters?.identifier) {
      const asset = await this.assetByIdentifierService.getAsset(
        filters?.identifier,
      );
      return asset
        ? new CollectionType({ items: [asset], count: asset ? 1 : 0 })
        : null;
    } else {
      return await this.getOrSetAssets(query, countQuery);
    }
  }

  private async getOrSetAssets(
    query: string,
    countQuery: string = '',
  ): Promise<CollectionType<Asset>> {
    try {
      const cacheKey = this.getAssetsQueryCacheKey(query);
      const getAssets = () => this.getAllAssets(query, countQuery);
      return this.redisCacheService.getOrSet(
        this.redisClient,
        cacheKey,
        getAssets,
        5 * TimeConstants.oneSecond,
      );
    } catch (error) {
      this.logger.error('An error occurred while get assets', {
        path: 'AssetsService.getAssets',
        query,
        exception: error,
      });
    }
  }

  private async getAssetsByOwnerAddress(
    filters: AssetsFilter,
    query: string = '',
    countQuery: string = '',
  ): Promise<CollectionType<Asset>> {
    if (filters?.identifier) {
      const asset = await this.getAssetByIdentifierAndAddress(
        filters.ownerAddress,
        filters.identifier,
      );
      return asset
        ? new CollectionType({ count: asset ? 1 : 0, items: [asset] })
        : null;
    } else {
      return await this.getAssetsForUser(
        filters.ownerAddress,
        query,
        countQuery,
      );
    }
  }

  private async getAssetsByArtistAddress(
    address: string,
    size: number = 25,
    offset: number = 0,
  ): Promise<CollectionType<Asset>> {
    const artistCollections = await this.collectionsService.getArtistCreations(
      address,
    );
    if (artistCollections) {
      const batch = artistCollections?.collections?.slice(0, 100);
      let elasticQuery = this.getCollectionsElasticQuery(batch, offset, size);
      let elasticNfts = await this.elasticService.getList(
        'tokens',
        'identifier',
        elasticQuery,
      );
      const returnAssets = await this.mapElasticNfts(elasticNfts);
      return new CollectionType({
        items: returnAssets,
        count: artistCollections.nfts,
      });
    }
    return new CollectionType({
      items: [],
      count: 0,
    });
  }

  private async mapElasticNfts(elasticNfts: any[]) {
    const assets = await this.getAssetsForIdentifiers(
      elasticNfts?.map((e) => e.identifier),
    );

    const returnAssets = [];
    for (const asset of elasticNfts) {
      returnAssets.push(assets.find((a) => a.identifier === asset.identifier));
    }
    return returnAssets;
  }

  private getCollectionsElasticQuery(
    collections: string[],
    offset: number,
    size: number,
  ) {
    return ElasticQuery.create()
      .withCondition(QueryConditionOptions.must, QueryType.Exists('identifier'))
      .withMustCondition(
        QueryType.Should(
          collections.map((collection) =>
            QueryType.Match('token', collection, QueryOperator.AND),
          ),
        ),
      )
      .withPagination(new QueryPagination({ from: offset, size: size }))
      .withSort([
        { name: 'timestamp', order: ElasticSortOrder.descending },
        { name: 'nonce', order: ElasticSortOrder.descending },
      ]);
  }

  private async getCollectionAssetsByTraits(
    collection: string,
    traits: NftTrait[],
    limit: number,
    offset: number,
    sortByRank?: Sort,
  ): Promise<CollectionType<Asset>> {
    const [nfts, count] = await this.nftTraitsService.getCollectionNftsByTraits(
      collection,
      traits,
      limit,
      offset,
      sortByRank,
    );
    const assets = nfts?.map((nft) => Asset.fromNft(nft));
    return new CollectionType({ items: assets, count: count });
  }

  private async getlikedByAssets(
    likedByAddress: string,
    limit: number,
    offset: number,
  ): Promise<CollectionType<Asset>> {
    const [assetsLiked, assetsCount] =
      await this.assetsLikedService.getAssetLiked(
        limit,
        offset,
        likedByAddress,
      );
    const assets = await this.getAssetsForIdentifiers(
      assetsLiked?.map((e) => e.identifier),
    );

    const returnAssets = [];
    for (const asset of assetsLiked) {
      returnAssets.push(assets.find((a) => a.identifier === asset.identifier));
    }
    return new CollectionType({ items: returnAssets, count: assetsCount });
  }

  private getApiQuery(filters: AssetsFilter, offset: number, limit: number) {
    return new AssetsQuery()
      .addCreator(filters?.creatorAddress)
      .addTags(filters?.tags)
      .addIdentifiers(filters?.identifiers)
      .addCollection(filters?.collection)
      .addCollections(filters?.collections)
      .addType(filters?.type)
      .withOwner()
      .withSupply()
      .addPageSize(offset, limit)
      .build();
  }

  private getApiQueryWithoutOwnerFlag(
    filters: AssetsFilter,
    offset: number,
    limit: number,
  ) {
    return new AssetsQuery()
      .addCreator(filters?.creatorAddress)
      .addTags(filters?.tags)
      .addIdentifiers(filters?.identifiers)
      .addCollection(filters?.collection)
      .addCollections(filters?.collections)
      .addType(filters?.type)
      .withSupply()
      .addPageSize(offset, limit)
      .build();
  }

  private getApiQueryForCount(filters: AssetsFilter) {
    return new AssetsQuery()
      .addCreator(filters?.creatorAddress)
      .addTags(filters?.tags)
      .addIdentifiers(filters?.identifiers)
      .addCollection(filters?.collection)
      .addCollections(filters?.collections)
      .addType(filters?.type)
      .build();
  }

  private async addToCache(response: CollectionType<Asset>) {
    if (response?.count && response?.items) {
      const assetsRarity = this.getAssetsWithRarity(response);
      await this.assetRarityLoader.batchRarity(
        assetsRarity?.map((a) => a.identifier),
        assetsRarity?.groupBy((asset) => asset.identifier, false),
      );
      let assetsWithScamInfo = response.items?.filter((x) => x?.scamInfo);
      await this.assetScamLoader.batchScamInfo(
        assetsWithScamInfo?.map((a) => a.identifier),
        assetsWithScamInfo?.groupBy((asset) => asset.identifier, false),
      );

      let assetsWithSupply = response.items?.filter((x) => x?.supply);
      await this.assetSupplyLoader.batchSupplyInfo(
        assetsWithSupply?.map((a) => a.identifier),
        assetsWithSupply?.groupBy((asset) => asset.identifier, false),
      );
    }
  }

  private getAssetsWithRarity(response: CollectionType<Asset>) {
    let assetsWithRarity = response.items?.filter((x) => x?.rarity);
    let assetsRarity = assetsWithRarity.map((a) => {
      return {
        identifier: a.identifier,
        rank: a.rarity.rank,
        score: a.rarity.score,
        rarity: a.rarity,
      };
    });
    return assetsRarity;
  }

  private getAssetsQueryCacheKey(request: any) {
    return generateCacheKeyFromParams('assets', hash(request));
  }
}
