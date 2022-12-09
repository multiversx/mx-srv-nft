import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Token {
  @Field(() => String)
  identifier: string;
  @Field(() => String)
  symbol: string;
  @Field(() => String)
  name: string;
  @Field(() => String, { nullable: true })
  priceUsd?: string;
  @Field(() => Number, { nullable: true })
  decimals?: number;
  @Field(() => Int, { nullable: true })
  activeAuctions?: number;

  constructor(init?: Partial<Token>) {
    Object.assign(this, init);
  }

  static fromElrondApiToken(token: any): Token {
    return new Token({
      identifier: token.id,
      symbol: token.symbol,
      name: token.name,
      priceUsd: token.price,
      decimals: token.decimals ?? undefined,
    });
  }
}
