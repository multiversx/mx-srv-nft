import {
  Address,
  AddressValue,
  Balance,
  BytesValue,
  ContractFunction,
  GasLimit,
} from '@elrondnetwork/erdjs';
import { Injectable } from '@nestjs/common';
import { ElrondApiService } from 'src/common/services/elrond-communication/elrond-api.service';
import { getSmartContract } from 'src/common/services/elrond-communication/smart-contract';
import { gas } from 'src/config';
import '../../utils/extentions';
import { AssetsFilter } from '../filtersTypes';
import { nominateStringVal, nominateVal } from '../formatters';
import { FileContent } from '../ipfs/file.content';
import { PinataService } from '../ipfs/pinata.service';
import { S3Service } from '../s3/s3.service';
import { TransactionNode } from '../transaction';
import { getCollectionAndNonceFromIdentifier } from '../transactionsProcessor/helpers';
import { AssetsLikesService } from './assets-likes.service';
import { AssetsQuery } from './assets-query';
import {
  CreateNftArgs,
  TransferNftArgs,
  Asset,
  HandleQuantityArgs,
} from './models';

@Injectable()
export class AssetsService {
  constructor(
    private apiService: ElrondApiService,
    private pinataService: PinataService,
    private s3Service: S3Service,
    private assetsLikedService: AssetsLikesService,
  ) {}

  async getAssetsForUser(
    address: string,
    query: string = '',
  ): Promise<[Asset[], number]> {
    const [nfts, count] = await Promise.all([
      this.apiService.getNftsForUser(address, query),
      this.apiService.getNftsForUserCount(address, query),
    ]);

    const assets = nfts.map((element) => Asset.fromNft(element));
    return [assets, count];
  }

  async getAssets(
    offset: number = 0,
    limit: number = 10,
    filters: AssetsFilter,
  ): Promise<[Asset[], number]> {
    const apiQuery = new AssetsQuery()
      .addCreator(filters?.creatorAddress)
      .addTags(filters?.tags)
      .addCollection(filters?.collection)
      .addType(filters?.type)
      .addPageSize(offset, limit)
      .build();

    if (filters?.likedByAddress) {
      return await this.getlikedByAssets(filters.likedByAddress, limit, offset);
    }
    if (filters?.ownerAddress) {
      return await this.getAssetsByOwnerAddress(filters, apiQuery);
    }

    return await this.getAssetsWithoutOwner(filters, apiQuery);
  }

  async getAssetByIdentifierAndAddress(
    onwerAddress: string,
    identifier: string,
  ): Promise<Asset> {
    const nft = await this.apiService.getNftByIdentifierAndAddress(
      onwerAddress,
      identifier,
    );
    return Asset.fromNft(nft);
  }

  async getAssetByIdentifier(identifier: string): Promise<Asset> {
    const nft = await this.apiService.getNftByIdentifier(identifier);
    return Asset.fromNft(nft);
  }

  async addQuantity(
    ownerAddress: string,
    args: HandleQuantityArgs,
  ): Promise<TransactionNode> {
    const { collection, nonce } = getCollectionAndNonceFromIdentifier(
      args.identifier,
    );
    const contract = getSmartContract(args.addOrBurnRoleAddress);
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTAddQuantity'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(collection),
        BytesValue.fromHex(nonce),
        BytesValue.fromHex(nominateStringVal(args.quantity)),
      ],
      gasLimit: new GasLimit(gas.addQuantity),
    });

    return transaction.toPlainObject();
  }

  async burnQuantity(
    ownerAddress: string,
    args: HandleQuantityArgs,
  ): Promise<TransactionNode> {
    const { collection, nonce } = getCollectionAndNonceFromIdentifier(
      args.identifier,
    );
    const contract = getSmartContract(args.addOrBurnRoleAddress);
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTBurn'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(collection),
        BytesValue.fromHex(nonce),
        BytesValue.fromHex(nominateStringVal(args.quantity)),
      ],
      gasLimit: new GasLimit(gas.burnQuantity),
    });

    return transaction.toPlainObject();
  }

  async createNft(
    ownerAddress: string,
    args: CreateNftArgs,
  ): Promise<TransactionNode> {
    const file = await args.file;
    const fileData = await this.pinataService.uploadFile(file);
    const fileMetadata = new FileContent({
      description: args.attributes.description,
      fileType: file.mimetype,
      fileUri: fileData.url,
      fileName: file.filename,
    });
    const asset = await this.pinataService.uploadText(fileMetadata);

    await this.s3Service.upload(file, fileData.hash);
    await this.s3Service.uploadText(fileMetadata, asset.hash);

    const attributes = `tags:${args.attributes.tags};metadata:${asset.hash}`;

    const contract = getSmartContract(ownerAddress);
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTCreate'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(args.collection),
        BytesValue.fromHex(nominateStringVal(args.quantity || '1')),
        BytesValue.fromUTF8(args.name),
        BytesValue.fromHex(nominateVal(parseFloat(args.royalties || '0'))),
        BytesValue.fromUTF8(fileData.hash),
        BytesValue.fromUTF8(attributes),
        BytesValue.fromUTF8(fileData.url),
      ],
      gasLimit: new GasLimit(gas.nftCreate),
    });

    return transaction.toPlainObject();
  }

  async transferNft(
    ownerAddress: string,
    transferNftArgs: TransferNftArgs,
  ): Promise<TransactionNode> {
    const { collection, nonce } = getCollectionAndNonceFromIdentifier(
      transferNftArgs.identifier,
    );
    const contract = getSmartContract(ownerAddress);
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTTransfer'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(collection),
        BytesValue.fromHex(nonce),
        BytesValue.fromHex(nominateStringVal(transferNftArgs.quantity || '1')),
        new AddressValue(new Address(transferNftArgs.destinationAddress)),
      ],
      gasLimit: new GasLimit(gas.nftTransfer),
    });

    return transaction.toPlainObject();
  }

  private async getAllAssets(query: string = ''): Promise<[Asset[], number]> {
    const [nfts, count] = await Promise.all([
      this.apiService.getAllNfts(query),
      this.apiService.getNftsCount(query),
    ]);
    const assets = nfts?.map((element) => Asset.fromNft(element));
    return [assets, count];
  }

  private async getAssetsWithoutOwner(
    filters: AssetsFilter,
    query: string = '',
  ): Promise<[Asset[], number]> {
    if (filters?.identifier) {
      return [[await this.getAssetByIdentifier(filters.identifier)], 1];
    } else {
      return await this.getAllAssets(query);
    }
  }

  private async getAssetsByOwnerAddress(
    filters: AssetsFilter,
    query: string = '',
  ): Promise<[Asset[], number]> {
    if (filters?.identifier) {
      return [
        [
          await this.getAssetByIdentifierAndAddress(
            filters.ownerAddress,
            filters.identifier,
          ),
        ],
        1,
      ];
    } else {
      return await this.getAssetsForUser(filters.ownerAddress, query);
    }
  }

  private async getlikedByAssets(
    likedByAddress: string,
    limit: number,
    offset: number,
  ): Promise<[Asset[], number]> {
    const [assetsLiked, assetsCount] =
      await this.assetsLikedService.getAssetLiked(
        limit,
        offset,
        likedByAddress,
      );
    const assetsPromises = assetsLiked.map((element) =>
      this.getAssetByIdentifier(element.identifier),
    );
    const assets = await Promise.all(assetsPromises);

    return [assets, assetsCount];
  }
}
