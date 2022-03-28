import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config/dist';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import { RedisModule } from 'nestjs-redis';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { ElrondCommunicationModule } from './common/services/elrond-communication/elrond-communication.module';
import { cacheConfig } from './config';
import { CachingModule } from './common/services/caching/caching.module';

const logTransports: Transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      nestWinstonModuleUtilities.format.nestLike(),
    ),
  }),
];

const logLevel = !!process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'error';

if (!!process.env.LOG_FILE) {
  logTransports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE,
      dirname: 'logs',
      maxsize: 100000,
      level: logLevel,
    }),
  );
}

@Module({
  imports: [
    forwardRef(() => CachingModule),
    ScheduleModule.forRoot(),
    ConfigModule,
    WinstonModule.forRoot({
      transports: logTransports,
    }),
    RedisModule.register([
      {
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: 0,
      },
      {
        name: cacheConfig.auctionsRedisClientName,
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: cacheConfig.auctionsDbName,
      },
      {
        name: cacheConfig.ordersRedisClientName,
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: cacheConfig.ordersDbName,
      },
      {
        name: cacheConfig.assetsRedisClientName,
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: cacheConfig.assetsDbName,
      },
      {
        name: cacheConfig.followersRedisClientName,
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: cacheConfig.followersDbName,
      },
      {
        name: cacheConfig.collectionsRedisClientName,
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: cacheConfig.collectionsDbName,
      },
    ]),

    TypeOrmModule.forRoot({
      keepConnectionAlive: true,
    }),
    ElrondCommunicationModule,
  ],
  exports: [ElrondCommunicationModule, CachingModule],
})
export class CommonModule {}
