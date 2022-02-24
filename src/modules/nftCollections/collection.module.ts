import { Module } from '@nestjs/common';
import { ElrondCommunicationModule } from '../../common/services/elrond-communication/elrond-communication.module';
import { CollectionsResolver } from './collection.resolver';
import { CollectionsService } from './collection.service';
import { AssetsModuleGraph } from '../assets/assets.module';
import { AccountsProvider } from '../account-stats/loaders/accounts.loader';
import { AccountsRedisHandler } from '../account-stats/loaders/accounts.redis-handler';

@Module({
  providers: [
    CollectionsService,
    CollectionsResolver,
    AccountsRedisHandler,
    AccountsProvider,
  ],
  imports: [ElrondCommunicationModule, AssetsModuleGraph],
  exports: [CollectionsService],
})
export class CollectionModuleGraph {}
