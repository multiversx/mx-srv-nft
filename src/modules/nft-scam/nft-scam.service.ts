import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from 'src/common/persistence/persistence.service';
import { ElrondApiService, ElrondElasticService, Nft } from 'src/common';
import { ElrondApiAbout } from 'src/common/services/elrond-communication/models/elrond-api-about.model';
import { constants } from 'src/config';
import { Locker } from 'src/utils/locker';
import { ScamInfo } from '../assets/models/ScamInfo.dto';
import { ScamInfoTypeEnum } from '../assets/models';
import { NftScamEntity } from 'src/db/reports-nft-scam';
import { NftScamElasticService } from './nft-scam.elastic.service';

@Injectable()
export class NftScamService {
  constructor(
    private persistenceService: PersistenceService,
    private nftScamElasticService: NftScamElasticService,
    private elrondElasticService: ElrondElasticService,
    private elrondApiService: ElrondApiService,
    private readonly logger: Logger,
  ) {}

  async validateOrUpdateNftScamInfo(
    identifier: string,
    optionalParams?: {
      elrondApiAbout?: ElrondApiAbout;
      nftFromApi?: Nft;
      nftFromElastic?: any;
      nftFromDb?: NftScamEntity;
    },
  ): Promise<void> {
    const [nftFromApi, nftFromElastic, nftFromDb, elrondApiAbout]: [
      Nft,
      any,
      NftScamEntity,
      ElrondApiAbout,
    ] = await this.getNftsAndElrondAbout(identifier, optionalParams);

    if (!nftFromApi.scamInfo) {
      await this.validateOrUpdateScamInfoDataForNoScamNft(
        elrondApiAbout,
        nftFromApi,
        nftFromElastic,
        nftFromDb,
      );
    } else if (nftFromApi.scamInfo) {
      await this.validateOrUpdateScamInfoDataForScamNft(
        elrondApiAbout,
        nftFromApi,
        nftFromElastic,
        nftFromDb,
      );
    }
  }

  async getNftsAndElrondAbout(
    identifier: string,
    optionalParams?: {
      elrondApiAbout?: ElrondApiAbout;
      nftFromApi?: Nft;
      nftFromElastic?: any;
      nftFromDb?: NftScamEntity;
    },
  ): Promise<[Nft, any, NftScamEntity, ElrondApiAbout]> {
    return await Promise.all([
      optionalParams?.nftFromApi ??
        this.elrondApiService.getNftScamInfo(identifier, true),
      optionalParams?.nftFromElastic ??
        this.nftScamElasticService.getNftWithScamInfoFromElastic(identifier),
      optionalParams?.nftFromDb ??
        this.persistenceService.getNftScamInfo(identifier),
      optionalParams?.elrondApiAbout ??
        this.elrondApiService.getElrondApiAbout(),
    ]);
  }

  async validateOrUpdateAllNftsScamInfo(): Promise<void> {
    await Locker.lock(
      'updateAllNftsScamInfos: Update scam info for all existing NFTs',
      async () => {
        try {
          const query =
            this.nftScamElasticService.getAllNftsWithScamInfoFromElasticQuery();
          const apiBatchSize = constants.getTokensFromApiBatchSize;
          const elrondApiAbout =
            await this.elrondApiService.getElrondApiAbout();

          let totalProcessedScamInfo = 0;

          await this.elrondElasticService.getScrollableList(
            'tokens',
            'identifier',
            query,
            async (nftsBatch) => {
              for (let i = 0; i < nftsBatch.length; i += apiBatchSize) {
                await this.validateOrUpdateNftsScamInfoBatch(
                  nftsBatch.slice(i, i + apiBatchSize),
                  elrondApiAbout,
                );
              }
              totalProcessedScamInfo += nftsBatch.length;
            },
          );

          this.logger.log(
            `Processed NFT Scam for ${totalProcessedScamInfo} NFTs`,
            {
              path: `${NftScamService.name}.${this.validateOrUpdateAllNftsScamInfo.name}`,
            },
          );
        } catch (error) {
          this.logger.error(
            'Error when updating/validating scam info for all NFTs',
            {
              path: `${NftScamService.name}.${this.validateOrUpdateAllNftsScamInfo.name}`,
              exception: error?.message,
            },
          );
        }
      },
      true,
    );
  }

  private async validateOrUpdateScamInfoDataForNoScamNft(
    elrondApiAbout: ElrondApiAbout,
    nftFromApi: Nft,
    nftFromElastic: any,
    nftFromDb: NftScamEntity,
  ): Promise<void> {
    const clearScamInfoInElastic = nftFromElastic.nft_scamInfoType;
    const updateScamInfoInElastic =
      clearScamInfoInElastic ||
      nftFromElastic.nft_scamInfoVersion !== elrondApiAbout.version;
    const updateScamInfoInDb = !nftFromDb || nftFromDb.type !== undefined;

    let updatePromises = [];

    if (updateScamInfoInDb) {
      updatePromises.push(
        this.persistenceService.saveOrUpdateNftScamInfo(
          nftFromApi.identifier,
          elrondApiAbout.version,
        ),
      );
    }
    if (updateScamInfoInElastic) {
      updatePromises.push(
        this.nftScamElasticService.setBulkNftScamInfoInElastic(
          [nftFromApi],
          elrondApiAbout.version,
          clearScamInfoInElastic,
        ),
      );
    }

    await Promise.all(updatePromises);
  }

  private async validateOrUpdateScamInfoDataForScamNft(
    elrondApiAbout: ElrondApiAbout,
    nftFromApi: Nft,
    nftFromElastic: any,
    nftFromDb: NftScamEntity,
  ): Promise<void> {
    const isElasticScamInfoDifferent =
      ScamInfo.areApiAndElasticScamInfoDifferent(
        nftFromApi,
        nftFromElastic,
        elrondApiAbout.version,
      );
    const isDbScamInfoDifferent = ScamInfo.areApiAndDbScamInfoDifferent(
      nftFromApi,
      nftFromDb,
      elrondApiAbout.version,
    );

    let updatePromises = [];

    if (isDbScamInfoDifferent) {
      updatePromises.push(
        this.persistenceService.saveOrUpdateNftScamInfo(
          nftFromApi.identifier,
          elrondApiAbout.version,
          new ScamInfo({
            type: ScamInfoTypeEnum[nftFromApi.scamInfo.type],
            info: nftFromApi.scamInfo.info,
          }),
        ),
      );
    }
    if (isElasticScamInfoDifferent) {
      updatePromises.push(
        this.nftScamElasticService.setBulkNftScamInfoInElastic(
          [nftFromApi],
          elrondApiAbout.version,
          true,
        ),
      );
    }

    await Promise.all(updatePromises);
  }

  private async validateOrUpdateNftsScamInfoBatch(
    nftsFromElastic: any,
    elrondApiAbout: ElrondApiAbout,
  ): Promise<void> {
    let nftsWithoutScamOutdatedInElastic: string[] = [];
    let nftsWithScamOutdatedInElastic: Nft[] = [];
    let nftsOutdatedOrMissingFromDb: Nft[] = [];

    const identifiers = nftsFromElastic.map((nft) => nft.identifier);

    const [nftsFromApi, nftsFromDb]: [Nft[], NftScamEntity[]] =
      await Promise.all([
        this.elrondApiService.getBulkNftScamInfo(identifiers, true),
        this.persistenceService.getBulkNftScamInfo(identifiers),
      ]);

    for (const nftFromApi of nftsFromApi) {
      const nftFromElastic = nftsFromElastic.find(
        (nft) => nft.identifier === nftFromApi.identifier,
      );
      const nftFromDb = nftsFromDb?.find(
        (nft) => nft.identifier === nftFromApi.identifier,
      );

      if (!nftFromApi.scamInfo) {
        const updateScamInfoInElastic =
          nftFromElastic.nft_scamInfoType !== undefined;
        const updateScamInfoInDb = !nftFromDb || nftFromDb.type !== undefined;
        if (updateScamInfoInElastic || updateScamInfoInDb) {
          if (updateScamInfoInElastic) {
            nftsWithoutScamOutdatedInElastic.push(nftFromApi.identifier);
          }
          if (updateScamInfoInDb) {
            nftsOutdatedOrMissingFromDb.push(nftFromApi);
          }

          this.logger.log(
            `${nftFromApi.identifier} - SCAM Info cleared / version saved`,
          );
        }
      }

      if (nftFromApi.scamInfo) {
        const isElasticScamInfoDifferent =
          ScamInfo.areApiAndElasticScamInfoDifferent(
            nftFromApi,
            nftFromElastic,
            elrondApiAbout.version,
          );

        const isDbScamInfoDifferent = ScamInfo.areApiAndDbScamInfoDifferent(
          nftFromApi,
          nftFromDb,
          elrondApiAbout.version,
        );

        if (isElasticScamInfoDifferent || isDbScamInfoDifferent) {
          if (isElasticScamInfoDifferent) {
            nftsWithScamOutdatedInElastic.push(nftFromApi);
          }
          if (isDbScamInfoDifferent) {
            nftsOutdatedOrMissingFromDb.push(nftFromApi);
          }
          this.logger.log(`${nftFromApi.identifier} - SCAM info updated`);
        }
      }
    }

    const elasticUpdates = this.nftScamElasticService
      .buildNftScamInfoBulkUpdate(
        nftsWithoutScamOutdatedInElastic,
        elrondApiAbout.version,
        true,
      )
      .concat(
        this.nftScamElasticService.buildNftScamInfoBulkUpdate(
          nftsWithScamOutdatedInElastic,
          elrondApiAbout.version,
        ),
      );

    await Promise.all([
      this.nftScamElasticService.updateBulkNftScamInfoInElastic(elasticUpdates),
      this.persistenceService.saveOrUpdateBulkNftScamInfo(
        nftsOutdatedOrMissingFromDb,
        elrondApiAbout.version,
      ),
    ]);
  }
}
