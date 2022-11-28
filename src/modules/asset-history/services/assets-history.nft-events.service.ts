import { Injectable } from '@nestjs/common';
import { elrondConfig } from 'src/config';
import { NftEventEnum, AssetActionEnum } from 'src/modules/assets/models';
import { AssetHistoryInput as AssetHistoryLogInput } from '../models/asset-history-log-input';

@Injectable()
export class AssetsHistoryNftEventService {
  constructor() {}

  mapNftEventLog(
    nonce: string,
    eventType: string,
    mainEvent: any,
  ): AssetHistoryLogInput {
    const event = mainEvent._source.events.find(
      (event) => event.identifier === eventType,
    );
    const encodedNonce = Buffer.from(nonce, 'hex').toString('base64');
    const transferEvent = mainEvent._source.events.find(
      (event) =>
        (event.identifier === NftEventEnum.ESDTNFTTransfer ||
          event.identifier === NftEventEnum.MultiESDTNFTTransfer) &&
        event.topics[1] === encodedNonce,
    );

    switch (eventType) {
      case NftEventEnum.ESDTNFTAddQuantity: {
        return new AssetHistoryLogInput({
          event: mainEvent,
          action: AssetActionEnum.Added,
          address: mainEvent._source.address,
          itemsCount: mainEvent._source.events[0].topics[2],
        });
      }
      case NftEventEnum.ESDTNFTCreate: {
        return new AssetHistoryLogInput({
          event: mainEvent,
          action: AssetActionEnum.Created,
          address: event.address,
          itemsCount: event.topics[2],
          sender: transferEvent?.topics[3]?.base64ToBech32(),
        });
      }
      case NftEventEnum.ESDTNFTTransfer: {
        if (
          mainEvent._source.address === mainEvent?._source.events[0].address &&
          transferEvent.topics[3].base64ToBech32() !==
            elrondConfig.nftMarketplaceAddress
        ) {
          return new AssetHistoryLogInput({
            event: mainEvent,
            action: AssetActionEnum.Received,
            address: transferEvent.topics[3].base64ToBech32(),
            itemsCount: transferEvent.topics[2],
            sender: transferEvent.address,
          });
        }
      }
      case NftEventEnum.MultiESDTNFTTransfer: {
        const senderAddress = transferEvent.address;
        const receiverAddress = transferEvent.topics[3].base64ToBech32();
        if (senderAddress !== receiverAddress) {
          return new AssetHistoryLogInput({
            event: mainEvent,
            action: AssetActionEnum.Received,
            address: receiverAddress,
            itemsCount: transferEvent.topics[2],
            sender: senderAddress,
          });
        }
      }
      default: {
        return this.mapNftEventLog(nonce, transferEvent.identifier, mainEvent);
      }
    }
  }
}
