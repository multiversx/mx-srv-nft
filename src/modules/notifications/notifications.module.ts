import { forwardRef, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { ElrondCommunicationModule } from 'src/common';
import { NotificationsModuleDb } from 'src/db/notifications/notifications.module.db';
import { CommonModule } from 'src/common.module';
import { OrdersModuleGraph } from '../orders/orders.module';
import { AssetByIdentifierService } from '../assets/asset-by-identifier.service';
import { NotificationsCachingService } from './notifications-caching.service';

@Module({
  providers: [
    NotificationsService,
    NotificationsCachingService,
    NotificationsResolver,
    AssetByIdentifierService,
  ],
  imports: [
    ElrondCommunicationModule,
    CommonModule,
    forwardRef(() => NotificationsModuleDb),
    forwardRef(() => OrdersModuleGraph),
  ],
  exports: [
    NotificationsService,
    AssetByIdentifierService,
    NotificationsCachingService,
  ],
})
export class NotificationsModuleGraph {}
