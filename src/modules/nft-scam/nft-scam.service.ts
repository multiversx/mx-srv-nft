import { Injectable, Logger } from '@nestjs/common';
import { ElrondApiService, ElrondElasticService, Nft } from 'src/common';
import { ElrondApiAbout } from 'src/common/services/elrond-communication/models/elrond-api-about.model';
import { Locker } from 'src/utils/locker';
import { ScamInfo } from '../assets/models/ScamInfo.dto';
import { ScamInfoTypeEnum } from '../assets/models';
import { NftScamElasticService } from './nft-scam.elastic.service';
import { NftScamRelatedData } from './models/nft-scam-data.model';
import { elasticDictionary } from 'src/config';
import { NftScamInfoModel } from './models/nft-scam-info.model';
import { DocumentDbService } from 'src/document-db/document-db.service';

@Injectable()
export class NftScamService {
  constructor(
    private documentDbService: DocumentDbService,
    private nftScamElasticService: NftScamElasticService,
    private elrondElasticService: ElrondElasticService,
    private elrondApiService: ElrondApiService,
    private readonly logger: Logger,
  ) {}

  async validateOrUpdateNftScamInfo(
    identifier: string,
    nftScamRelatedData?: NftScamRelatedData,
    clearManualScamInfo: boolean = false,
  ): Promise<boolean> {
    const [nftFromApi, nftFromElastic, nftFromDb, elrondApiAbout]: [
      Nft,
      any,
      NftScamInfoModel,
      ElrondApiAbout,
    ] = await this.getNftsAndElrondAbout(identifier, nftScamRelatedData);
    const scamInfoVersion = elrondApiAbout.scamInfoVersion;

    if (
      nftFromDb?.version === elasticDictionary.scamInfo.manualVersionValue &&
      !clearManualScamInfo
    ) {
      return true;
    }

    if (!nftFromApi.scamInfo) {
      await this.validateOrUpdateScamInfoDataForNoScamNft(
        scamInfoVersion,
        nftFromApi,
        nftFromElastic,
        nftFromDb,
      );
    } else if (nftFromApi.scamInfo) {
      await this.validateOrUpdateScamInfoDataForScamNft(
        scamInfoVersion,
        nftFromApi,
        nftFromElastic,
        nftFromDb,
      );
    }

    return true;
  }

  async getNftsAndElrondAbout(
    identifier: string,
    nftScamRelatedData?: NftScamRelatedData,
  ): Promise<[Nft, any, NftScamInfoModel, ElrondApiAbout]> {
    return await Promise.all([
      nftScamRelatedData?.nftFromApi ??
        this.elrondApiService.getNftScamInfo(identifier, true),
      nftScamRelatedData?.nftFromElastic ??
        this.nftScamElasticService.getNftWithScamInfoFromElastic(identifier),
      nftScamRelatedData?.nftFromDb ??
        this.documentDbService.getNftScamInfo(identifier),
      nftScamRelatedData?.elrondApiAbout ??
        this.elrondApiService.getElrondApiAbout(),
    ]);
  }

  async validateOrUpdateAllNftsScamInfo(): Promise<void> {
    await Locker.lock(
      'updateAllNftsScamInfos: Update scam info for all existing NFTs',
      async () => {
        try {
          const elrondApiAbout =
            await this.elrondApiService.getElrondApiAbout();
          const scamInfoVersion = elrondApiAbout.scamInfoVersion;

          const collections =
            await this.nftScamElasticService.getAllCollectionsFromElastic();

          for (let i = 0; i < collections.length; i++) {
            await this.validateOrUpdateAllNftsScamInfoForCollection(
              collections[i],
              scamInfoVersion,
            );
          }

          this.logger.log(
            `Processed NFT Scam Info for ${collections.length} collections`,
            {
              path: `${NftScamService.name}.${this.validateOrUpdateAllNftsScamInfo.name}`,
            },
          );
        } catch (error) {
          this.logger.error(
            `Error when updating/validating scam info for all collections`,
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

  async validateOrUpdateAllNftsScamInfoForCollection(
    collection: string,
    scamInfoVersion: string,
  ): Promise<void> {
    this.logger.log(`Processing scamInfo for ${collection}...`, {
      path: `${NftScamService.name}.${this.validateOrUpdateAllNftsScamInfoForCollection.name}`,
    });
    const nftsQuery =
      this.nftScamElasticService.getAllCollectionNftsFromElasticQuery(
        collection,
      );
    await this.elrondElasticService.getScrollableList(
      'tokens',
      'identifier',
      nftsQuery,
      async (nftsBatch) => {
        await this.validateOrUpdateNftsScamInfoBatch(
          nftsBatch,
          scamInfoVersion,
        );
      },
    );
  }

  async manuallySetNftScamInfo(
    identifier: string,
    type: ScamInfoTypeEnum,
    info: string,
  ): Promise<boolean> {
    await Promise.all([
      this.documentDbService.saveOrUpdateNftScamInfo(
        identifier,
        'manual',
        new ScamInfo({
          type: ScamInfoTypeEnum[type],
          info: info,
        }),
      ),
      this.nftScamElasticService.setNftScamInfoManuallyInElastic(
        identifier,
        type,
        info,
      ),
    ]);
    return true;
  }

  async manuallyClearNftScamInfo(identifier: string): Promise<boolean> {
    return await this.validateOrUpdateNftScamInfo(identifier, {}, true);
  }

  private async validateOrUpdateScamInfoDataForNoScamNft(
    scamInfoVersion: string,
    nftFromApi: Nft,
    nftFromElastic: any,
    nftFromDb: NftScamInfoModel,
  ): Promise<void> {
    const clearScamInfoInElastic =
      nftFromElastic[elasticDictionary.scamInfo.typeKey];

    const updateScamInfoInDb =
      !nftFromDb || nftFromDb.type || nftFromDb.version !== scamInfoVersion;

    let updatePromises = [];

    if (updateScamInfoInDb) {
      updatePromises.push(
        this.documentDbService.saveOrUpdateNftScamInfo(
          nftFromApi.identifier,
          scamInfoVersion,
        ),
      );
    }
    if (clearScamInfoInElastic) {
      updatePromises.push(
        this.nftScamElasticService.setBulkNftScamInfoInElastic(
          [nftFromApi],
          true,
        ),
      );
    }

    await Promise.all(updatePromises);
  }

  private async validateOrUpdateScamInfoDataForScamNft(
    scamInfoVersion: string,
    nftFromApi: Nft,
    nftFromElastic: any,
    nftFromDb: NftScamInfoModel,
  ): Promise<void> {
    const isElasticScamInfoDifferent =
      ScamInfo.areApiAndElasticScamInfoDifferent(nftFromApi, nftFromElastic);
    const isDbScamInfoDifferent = ScamInfo.areApiAndDbScamInfoDifferent(
      nftFromApi,
      nftFromDb,
      scamInfoVersion,
    );

    let updatePromises = [];

    if (isDbScamInfoDifferent) {
      updatePromises.push(
        this.documentDbService.saveOrUpdateNftScamInfo(
          nftFromApi.identifier,
          scamInfoVersion,
          new ScamInfo({
            type: ScamInfoTypeEnum[nftFromApi.scamInfo.type],
            info: nftFromApi.scamInfo.info,
          }),
        ),
      );
    }
    if (isElasticScamInfoDifferent) {
      updatePromises.push(
        this.nftScamElasticService.setBulkNftScamInfoInElastic([nftFromApi]),
      );
    }

    await Promise.all(updatePromises);
  }

  private async validateOrUpdateNftsScamInfoBatch(
    nftsFromElastic: any,
    scamInfoVersion: string,
  ): Promise<void> {
    if (!nftsFromElastic || nftsFromElastic.length === 0) {
      return;
    }

    const [
      nftsNoScamOutdatedInElastic,
      nftsScamOutdatedInElastic,
      nftsOutdatedOrMissingFromDb,
    ] = await this.filterOutdatedNfts(nftsFromElastic, scamInfoVersion);

    const elasticUpdates = this.nftScamElasticService
      .buildNftScamInfoBulkUpdate(nftsScamOutdatedInElastic)
      .concat(
        this.nftScamElasticService.buildNftScamInfoBulkUpdate(
          nftsNoScamOutdatedInElastic,
          true,
        ),
      );

    await Promise.all([
      this.nftScamElasticService.updateBulkNftScamInfoInElastic(elasticUpdates),
      this.documentDbService.saveOrUpdateBulkNftScamInfo(
        nftsOutdatedOrMissingFromDb,
        scamInfoVersion,
      ),
    ]);
  }

  private async filterOutdatedNfts(
    nftsFromElastic: any,
    scamInfoVersion: string,
  ): Promise<[Nft[], Nft[], Nft[]]> {
    let nftsNoScamOutdatedInElastic: Nft[] = [];
    let nftsScamOutdatedInElastic: Nft[] = [];
    let nftsOutdatedOrMissingFromDb: Nft[] = [];

    const identifiers = nftsFromElastic.map((nft) => nft.identifier);

    const [nftsFromApi, nftsFromDb]: [Nft[], NftScamInfoModel[]] =
      await Promise.all([
        this.elrondApiService.getBulkNftScamInfo(identifiers, true),
        this.documentDbService.getBulkNftScamInfo(identifiers),
      ]);

    if (!nftsFromApi || nftsFromApi.length === 0) {
      return;
    }

    for (let i = 0; i < nftsFromApi?.length; i++) {
      const nftFromApi = nftsFromApi[i];
      let nftFromElastic = nftsFromElastic.find(
        (nft) => nft.identifier === nftFromApi.identifier,
      );
      const nftFromDb = nftsFromDb?.find(
        (nft) => nft.identifier === nftFromApi.identifier,
      );

      if (
        nftFromDb?.version === elasticDictionary.scamInfo.manualVersionValue
      ) {
        continue;
      }

      if (!nftFromApi.scamInfo) {
        const updateScamInfoInElastic =
          nftFromElastic[elasticDictionary.scamInfo.typeKey];
        const updateScamInfoInDb =
          !nftFromDb ||
          nftFromDb?.type !== null ||
          nftFromDb?.version !== scamInfoVersion;

        if (updateScamInfoInElastic) {
          nftsNoScamOutdatedInElastic.push(nftFromApi);
        }
        if (updateScamInfoInDb) {
          nftsOutdatedOrMissingFromDb.push(nftFromApi);
        }
      } else if (nftFromApi.scamInfo) {
        const isElasticScamInfoDifferent =
          ScamInfo.areApiAndElasticScamInfoDifferent(
            nftFromApi,
            nftFromElastic,
          );

        const isDbScamInfoDifferent = ScamInfo.areApiAndDbScamInfoDifferent(
          nftFromApi,
          nftFromDb,
          scamInfoVersion,
        );

        if (isElasticScamInfoDifferent) {
          nftsScamOutdatedInElastic.push(nftFromApi);
        }
        if (isDbScamInfoDifferent) {
          nftsOutdatedOrMissingFromDb.push(nftFromApi);
        }
      }
    }

    return [
      nftsNoScamOutdatedInElastic,
      nftsScamOutdatedInElastic,
      nftsOutdatedOrMissingFromDb,
    ];
  }
}
