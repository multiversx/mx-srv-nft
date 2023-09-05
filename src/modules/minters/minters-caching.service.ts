import { Injectable, Logger } from '@nestjs/common';
import '../../utils/extensions';
import { CachingService } from '@multiversx/sdk-nestjs';
import { CacheInfo } from 'src/common/services/caching/entities/cache.info';
import { MinterEntity } from 'src/db/minters';

@Injectable()
export class MintersCachingService {
  constructor(private cacheService: CachingService, private readonly logger: Logger) {}

  public async getMinters(getMinters: () => any): Promise<MinterEntity[]> {
    return await this.cacheService.getOrSetCache(CacheInfo.Minters.key, () => getMinters(), CacheInfo.Minters.ttl);
  }

  public async invalidateMinters() {
    this.logger.log(`Deleting cache key(s) ${CacheInfo.Minters.key} `);
    await this.cacheService.deleteInCache(CacheInfo.Minters.key);
  }
}
