import { Field, Float, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AggregateValue {
    @Field(() => String, { nullable: true })
    time?: string;

    @Field(() => Float, { nullable: true })
    min?: number;

    @Field(() => Float, { nullable: true })
    max?: number;

    @Field(() => Float, { nullable: true })
    count?: number;

    @Field(() => Float, { nullable: true })
    sum?: number;

    @Field(() => Float, { nullable: true })
    avg?: number;

    constructor(init?: Partial<AggregateValue>) {
        Object.assign(this, init);
    }

    static fromDataApi(row: any) {
        return new AggregateValue({
            time: row.time ?? undefined,
            min: row.min,
            max: row.max,
            count: row.count,
            sum: row.sum,
            avg: row.avg,
        });
    }
}