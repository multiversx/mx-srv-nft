import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ApiService } from '../api.service';
import { EventEnum, Feed, TopicEnum } from './models/feed.dto';

@Injectable()
export class ElrondFeedService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly apiService: ApiService,
  ) {}

  async subscribe(identifier: string, token?: string): Promise<boolean> {
    const url = `${process.env.ELROND_FEED}api/v1/subscribe/nft:${identifier}`;

    try {
      console.log(identifier, token);
      return true;
      const response = await this.apiService.post(url, '', undefined, token);
      return response.data;
    } catch (error) {
      this.logger.error(
        `An error occurred while calling the elrond feed api on url ${url}`,
        {
          path: 'ElrondFeedService.subscribe',
          identifier,
          exception: error,
        },
      );
      return;
    }
  }

  async unsubscribe(reference: string, token?: string): Promise<boolean> {
    const url = `${process.env.ELROND_FEED}api/v1/unsubscribe/nft:${reference}`;

    try {
      console.log(reference, token);
      return true;
      const response = await this.apiService.post(url, '', undefined, token);
      return response.data;
    } catch (error) {
      this.logger.error(
        `An error occurred while calling the elrond feed api on url ${url}`,
        {
          path: 'ElrondFeedService.subscribe',
          reference,
          exception: error,
        },
      );
      return;
    }
  }

  async addFeed(
    address: string,
    event: EventEnum,
    reference: string,
    token?: string,
  ): Promise<Feed> {
    const url = `${process.env.ELROND_FEED}api/v1/feed`;
    let request: Feed = new Feed({
      address: address,
      topic: TopicEnum.nft,
      event: event,
      reference: reference,
    });
    try {
      console.log(request, token);
      return request;
      const response = await this.apiService.post(
        url,
        request,
        undefined,
        token,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `An error occurred while calling the elrond feed api on url ${url}`,
        {
          path: 'ElrondFeedService.addFeed',
          reference: reference,
          exception: error,
        },
      );
      return;
    }
  }
}
