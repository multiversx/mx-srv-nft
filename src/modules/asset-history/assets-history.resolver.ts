import { Resolver, Query, Args } from '@nestjs/graphql';
import { BaseResolver } from '../common/base.resolver';
import { AssetHistoryLog } from './models/asset-history.dto';
import { AssetsHistoryService } from '.';
import { getCollectionAndNonceFromIdentifier } from 'src/utils/helpers';
import { AssetHistoryLogResponse } from './models';
import {
  HistoryEdge,
  HistoryPagination,
} from '../common/filters/ConnectionArgs';
import { DateUtils } from 'src/utils/date-utils';
import { AssetHistoryFilter } from '../common/filters/filtersTypes';

@Resolver(() => AssetHistoryLogResponse)
export class AssetsHistoryResolver extends BaseResolver(AssetHistoryLog) {
  constructor(private assetsHistoryService: AssetsHistoryService) {
    super();
  }

  @Query(() => AssetHistoryLogResponse)
  async assetHistory(
    @Args({ name: 'filters', type: () => AssetHistoryFilter })
    filters,
    @Args({ name: 'pagination', type: () => HistoryPagination, nullable: true })
    pagination: HistoryPagination,
  ): Promise<AssetHistoryLogResponse> {
    const { collection, nonce } = getCollectionAndNonceFromIdentifier(
      filters.identifier,
    );
    let [historyLog] = [[], 0];
    await this.assetsHistoryService.getHistoryLog(
      collection,
      nonce,
      pagination.first,
      pagination.timestamp,
      historyLog,
    );

    return this.mapResponse(
      historyLog || [],
      pagination.timestamp,
      pagination.first,
    );
  }

  private mapResponse(
    returnList: AssetHistoryLog[],
    offset: number,
    limit: number,
  ) {
    const startTimestamp = offset
      ? offset
      : returnList.length > 0
      ? returnList[0]?.actionDate
      : DateUtils.getCurrentTimestamp();

    return {
      edges: returnList?.map(
        (elem) =>
          new HistoryEdge<AssetHistoryLog>({
            cursor: elem.actionDate.toString(),
            node: elem,
          }),
      ),
      pageInfo: {
        startCursor: startTimestamp,
        endCursor: returnList[returnList.length - 1]?.actionDate,
        hasNextPage: returnList?.length === limit,
      },
      pageData: { count: returnList?.length, limit, offset: startTimestamp },
    };
  }
}
