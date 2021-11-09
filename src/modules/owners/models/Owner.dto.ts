import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OwnerApi } from 'src/common/services/elrond-communication/models/onwer.api';
import { Account } from 'src/modules/accounts/models';

@ObjectType()
export class Owner {
  @Field(() => ID, { nullable: true })
  identifier: string;
  @Field({ nullable: true })
  address: string;
  @Field({ nullable: true })
  account: Account;
  @Field({ nullable: true })
  balance: string;

  constructor(init?: Partial<Owner>) {
    Object.assign(this, init);
  }

  static fromApiOwner(owner: OwnerApi, identifier: string) {
    return new Owner({
      address: owner.address,
      balance: owner.balance,
      identifier: identifier,
    });
  }
}
