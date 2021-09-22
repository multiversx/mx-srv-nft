import { FiltersExpression, Grouping, Sorting } from 'src/modules/filtersTypes';

export class QueryRequest {
  limit: number = 20;
  offset: number = 0;
  filters: FiltersExpression;
  sorting: Sorting[];
  groupByOption: Grouping;

  constructor(init?: Partial<QueryRequest>) {
    Object.assign(this, init);
  }
}

export class TrendingQueryRequest {
  limit: number = 20;
  offset: number = 0;
  startDate: Date;
  endDate: Date;

  constructor(init?: Partial<TrendingQueryRequest>) {
    Object.assign(this, init);
  }
}
