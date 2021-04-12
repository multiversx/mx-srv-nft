import { Injectable } from '@nestjs/common';
import '../../utils/extentions';
import { ElrondProxyService } from '../../common/services/elrond-communication/elrond-proxy.service';
import { Asset } from './dto/asset.dto';
import { Query } from '@nestjs/graphql/dist/decorators/query.decorator';

@Injectable()
export class AssetsService {
  constructor(private elrondProxyService: ElrondProxyService) {}

  @Query(() => String)
  async getAssetsForUser(address: string): Promise<Asset[] | any> {
    // this.elrondApiService.getService().
    return new Array<Asset>();
  }

  async getNftsForUser(address: string): Promise<Asset[] | any> {
    return {};
  }
}
