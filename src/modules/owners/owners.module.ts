import { Module } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { ElrondCommunicationModule } from 'src/common';
import { OwnersResolver } from './owners.resolver';
import { AccountsProvider } from '../account-stats/loaders/accounts.loader';
import { AccountsRedisHandler } from '../account-stats/loaders/accounts.redis-handler';

@Module({
  providers: [
    OwnersService,
    OwnersResolver,
    AccountsRedisHandler,
    AccountsProvider,
  ],
  imports: [ElrondCommunicationModule],
  exports: [OwnersService, AccountsRedisHandler, AccountsProvider],
})
export class OwnersModuleGraph {}
