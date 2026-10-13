/**
 * The result type of each aggregate this target contributes, keyed by operation and input codec, in the shape an emitted `contract.d.ts` gives as `AggregateTypes`. A contract written in TypeScript reads it from the target pack. `test/integration/test/contract-parity` checks it equals the emitted one.
 */
export type AggregateTypes = {
  readonly avg: {
    readonly byCodec: {
      readonly 'pg/float@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/float4@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/float8@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/interval@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/numeric@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/time-string@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/time-temporal@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'sql/float@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
    };
  };
  readonly avgDecimal: {
    readonly byCodec: {
      readonly 'pg/int@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/numeric@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
    };
  };
  readonly count: {
    readonly byCodec: Record<never, never>;
    readonly withoutInput: { readonly output: 'pg/int8number@1'; readonly nullable: false };
    readonly anyInput: { readonly output: 'pg/int8number@1'; readonly nullable: false };
  };
  readonly countBigInt: {
    readonly byCodec: Record<never, never>;
    readonly withoutInput: { readonly output: 'pg/int8@1'; readonly nullable: false };
    readonly anyInput: { readonly output: 'pg/int8@1'; readonly nullable: false };
  };
  readonly max: {
    readonly byCodec: {
      readonly 'pg/char@1': { readonly output: 'pg/char@1'; readonly nullable: true };
      readonly 'pg/date-string@1': { readonly output: 'pg/date-string@1'; readonly nullable: true };
      readonly 'pg/date-temporal@1': {
        readonly output: 'pg/date-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/enum@1': { readonly output: 'pg/enum@1'; readonly nullable: true };
      readonly 'pg/float@1': { readonly output: 'pg/float@1'; readonly nullable: true };
      readonly 'pg/float4@1': { readonly output: 'pg/float4@1'; readonly nullable: true };
      readonly 'pg/float8@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/inet@1': { readonly output: 'pg/inet@1'; readonly nullable: true };
      readonly 'pg/int@1': { readonly output: 'pg/int@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/int2@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/int4@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/interval@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/numeric@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/text-array@1': { readonly output: 'pg/text-array@1'; readonly nullable: true };
      readonly 'pg/text@1': { readonly output: 'pg/text@1'; readonly nullable: true };
      readonly 'pg/time-string@1': { readonly output: 'pg/time-string@1'; readonly nullable: true };
      readonly 'pg/time-temporal@1': {
        readonly output: 'pg/time-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamp-string@1': {
        readonly output: 'pg/timestamp-string@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamp-temporal@1': {
        readonly output: 'pg/timestamp-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-date@1': {
        readonly output: 'pg/timestamptz-date@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-string@1': {
        readonly output: 'pg/timestamptz-string@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-temporal@1': {
        readonly output: 'pg/timestamptz-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timetz@1': { readonly output: 'pg/timetz@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': {
        readonly output: 'pg/unboundedint@1';
        readonly nullable: true;
      };
      readonly 'pg/varchar@1': { readonly output: 'pg/text@1'; readonly nullable: true };
      readonly 'sql/char@1': { readonly output: 'sql/char@1'; readonly nullable: true };
      readonly 'sql/float@1': { readonly output: 'sql/float@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sql/int@1'; readonly nullable: true };
      readonly 'sql/text@1': { readonly output: 'sql/text@1'; readonly nullable: true };
      readonly 'sql/varchar@1': { readonly output: 'pg/text@1'; readonly nullable: true };
    };
  };
  readonly min: {
    readonly byCodec: {
      readonly 'pg/char@1': { readonly output: 'pg/char@1'; readonly nullable: true };
      readonly 'pg/date-string@1': { readonly output: 'pg/date-string@1'; readonly nullable: true };
      readonly 'pg/date-temporal@1': {
        readonly output: 'pg/date-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/enum@1': { readonly output: 'pg/enum@1'; readonly nullable: true };
      readonly 'pg/float@1': { readonly output: 'pg/float@1'; readonly nullable: true };
      readonly 'pg/float4@1': { readonly output: 'pg/float4@1'; readonly nullable: true };
      readonly 'pg/float8@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/inet@1': { readonly output: 'pg/inet@1'; readonly nullable: true };
      readonly 'pg/int@1': { readonly output: 'pg/int@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/int2@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/int4@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/interval@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/numeric@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/text-array@1': { readonly output: 'pg/text-array@1'; readonly nullable: true };
      readonly 'pg/text@1': { readonly output: 'pg/text@1'; readonly nullable: true };
      readonly 'pg/time-string@1': { readonly output: 'pg/time-string@1'; readonly nullable: true };
      readonly 'pg/time-temporal@1': {
        readonly output: 'pg/time-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamp-string@1': {
        readonly output: 'pg/timestamp-string@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamp-temporal@1': {
        readonly output: 'pg/timestamp-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-date@1': {
        readonly output: 'pg/timestamptz-date@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-string@1': {
        readonly output: 'pg/timestamptz-string@1';
        readonly nullable: true;
      };
      readonly 'pg/timestamptz-temporal@1': {
        readonly output: 'pg/timestamptz-temporal@1';
        readonly nullable: true;
      };
      readonly 'pg/timetz@1': { readonly output: 'pg/timetz@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': {
        readonly output: 'pg/unboundedint@1';
        readonly nullable: true;
      };
      readonly 'pg/varchar@1': { readonly output: 'pg/text@1'; readonly nullable: true };
      readonly 'sql/char@1': { readonly output: 'sql/char@1'; readonly nullable: true };
      readonly 'sql/float@1': { readonly output: 'sql/float@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sql/int@1'; readonly nullable: true };
      readonly 'sql/text@1': { readonly output: 'sql/text@1'; readonly nullable: true };
      readonly 'sql/varchar@1': { readonly output: 'pg/text@1'; readonly nullable: true };
    };
  };
  readonly sum: {
    readonly byCodec: {
      readonly 'pg/float@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/float4@1': { readonly output: 'pg/float4@1'; readonly nullable: true };
      readonly 'pg/float8@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'pg/int@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
      readonly 'pg/interval@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/numeric@1': { readonly output: 'pg/numeric@1'; readonly nullable: true };
      readonly 'pg/time-string@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/time-temporal@1': { readonly output: 'pg/interval@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': {
        readonly output: 'pg/unboundedint@1';
        readonly nullable: true;
      };
      readonly 'sql/float@1': { readonly output: 'pg/float8@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'pg/int8number@1'; readonly nullable: true };
    };
  };
  readonly sumBigInt: {
    readonly byCodec: {
      readonly 'pg/int@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
      readonly 'pg/int2@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
      readonly 'pg/int4@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
      readonly 'pg/int8@1': { readonly output: 'pg/unboundedint@1'; readonly nullable: true };
      readonly 'pg/int8number@1': { readonly output: 'pg/unboundedint@1'; readonly nullable: true };
      readonly 'pg/unboundedint@1': {
        readonly output: 'pg/unboundedint@1';
        readonly nullable: true;
      };
      readonly 'sql/int@1': { readonly output: 'pg/int8@1'; readonly nullable: true };
    };
  };
};
