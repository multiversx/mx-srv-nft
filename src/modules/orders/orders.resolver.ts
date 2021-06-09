import {
  Resolver,
  Query,
  Args,
  ResolveField,
  Parent,
  Mutation,
} from '@nestjs/graphql';
import { BaseResolver } from '../base.resolver';
import { Account } from '../accounts/models/account.dto';
import { Auction } from '../auctions/models';
import { OrdersService } from './order.service';
import { CreateOrderArgs, Order } from './models';

@Resolver(() => Order)
export class OrdersResolver extends BaseResolver(Order) {
  constructor(private ordersService: OrdersService) {
    super();
  }

  @Mutation(() => Order)
  async createOrder(@Args('input') input: CreateOrderArgs): Promise<Order> {
    return await this.ordersService.createOrder(input);
  }

  @Query(() => [Order])
  async getOrdersForAsset(@Args('token') token: string) {
    return {};
  }

  @ResolveField('from', () => Account)
  async from(@Parent() order: Order) {
    const { from } = order;
    return {};
  }

  @ResolveField('auction', () => Auction)
  async auction(@Parent() order: Order) {
    const { auction } = order;
    return {};
  }
}
