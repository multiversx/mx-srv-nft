import {
  Address,
  Balance,
  BytesValue,
  ContractFunction,
  GasLimit,
  SmartContract,
} from '@elrondnetwork/erdjs';
import { Injectable } from '@nestjs/common';
import { ElrondApiService } from 'src/common/services/elrond-communication/elrond-api.service';
import { AssetsServiceDb } from 'src/db/assets/assets.service';
import '../../utils/extentions';
import { Asset } from '../nfts/dto/asset.dto';
import CreateNftArgs, { TransferNftArgs } from '../nfts/dto/createNftArgs';
import { TransactionNode } from '../nfts/dto/transaction';

@Injectable()
export class AssetsService {
  constructor(private apiService: ElrondApiService) {}

  async getAssetsForUser(address: string): Promise<Asset[] | any> {
    const tokens = await this.apiService.getNftsForUser(address);
    let assets: Asset[] = [];
    tokens.forEach((element) => {
      assets.push(
        new Asset({
          tokenId: element.token,
          tokenNonce: element.nonce,
          creatorAddress: element.creator,
          ownerAddress: element.owner,
          lastSale: new Date(),
          creationDate: new Date(),
          hash: element.hash,
          name: element.name,
          royalties: element.royalties,
          uris: element.uris || [''],
        }),
      );
    });
    return assets;
  }

  async createNft(createAssetArgs: CreateNftArgs): Promise<TransactionNode> {
    const contract = new SmartContract({
      address: new Address(createAssetArgs.ownerAddress),
    });
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTCreate'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(createAssetArgs.tokenIdentifier),
        BytesValue.fromHex(this.nominateVal(createAssetArgs.tokenNonce || '1')),
        BytesValue.fromUTF8(createAssetArgs.name),
        BytesValue.fromHex(
          this.nominateVal(createAssetArgs.royalties || '0', 100),
        ),
        BytesValue.fromUTF8(createAssetArgs.hash),
        BytesValue.fromUTF8(createAssetArgs.attributes),
        BytesValue.fromUTF8(createAssetArgs.uri),
      ],
      gasLimit: new GasLimit(60000000),
    });
    return transaction.toPlainObject();
  }

  async transferNft(
    transferNftArgs: TransferNftArgs,
  ): Promise<TransactionNode> {
    const contract = new SmartContract({
      address: new Address(transferNftArgs.ownerAddress),
    });
    const transaction = contract.call({
      func: new ContractFunction('ESDTNFTTransfer'),
      value: Balance.egld(0),
      args: [
        BytesValue.fromUTF8(transferNftArgs.tokenIdentifier),
        BytesValue.fromHex(this.nominateVal(transferNftArgs.quantity || '1')),
        BytesValue.fromUTF8(transferNftArgs.destinationAddress),
      ],
      gasLimit: new GasLimit(60000000),
    });
    return transaction.toPlainObject();
  }

  private nominateVal(value: string, perc: number = 1): string {
    let response = (parseFloat(value) * perc).toString(16);
    if (response.length % 2 !== 0) {
      response = '0' + response;
    }
    return response;
  }
}
