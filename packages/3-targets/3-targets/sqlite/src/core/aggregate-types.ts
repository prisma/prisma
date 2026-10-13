/**
 * The result type of each aggregate this target contributes, keyed by operation and input codec, in the shape an emitted `contract.d.ts` gives as `AggregateTypes`. A contract written in TypeScript reads it from the target pack. `test/integration/test/contract-parity` checks it equals the emitted one.
 */
export type AggregateTypes = {
  readonly avg: {
    readonly byCodec: {
      readonly 'sql/float@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sqlite/bigint@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sqlite/bigintnumber@1': {
        readonly output: 'sqlite/real@1';
        readonly nullable: true;
      };
      readonly 'sqlite/integer@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sqlite/real@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
    };
  };
  readonly count: {
    readonly byCodec: Record<never, never>;
    readonly withoutInput: { readonly output: 'sqlite/bigintnumber@1'; readonly nullable: false };
    readonly anyInput: { readonly output: 'sqlite/bigintnumber@1'; readonly nullable: false };
  };
  readonly countBigInt: {
    readonly byCodec: Record<never, never>;
    readonly withoutInput: { readonly output: 'sqlite/bigint@1'; readonly nullable: false };
    readonly anyInput: { readonly output: 'sqlite/bigint@1'; readonly nullable: false };
  };
  readonly max: {
    readonly byCodec: {
      readonly 'sql/char@1': { readonly output: 'sql/char@1'; readonly nullable: true };
      readonly 'sql/float@1': { readonly output: 'sql/float@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sql/int@1'; readonly nullable: true };
      readonly 'sql/varchar@1': { readonly output: 'sql/varchar@1'; readonly nullable: true };
      readonly 'sqlite/bigint@1': { readonly output: 'sqlite/bigint@1'; readonly nullable: true };
      readonly 'sqlite/bigintnumber@1': {
        readonly output: 'sqlite/bigintnumber@1';
        readonly nullable: true;
      };
      readonly 'sqlite/blob@1': { readonly output: 'sqlite/blob@1'; readonly nullable: true };
      readonly 'sqlite/datetime@1': {
        readonly output: 'sqlite/datetime@1';
        readonly nullable: true;
      };
      readonly 'sqlite/integer@1': { readonly output: 'sqlite/integer@1'; readonly nullable: true };
      readonly 'sqlite/json@1': { readonly output: 'sqlite/json@1'; readonly nullable: true };
      readonly 'sqlite/real@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sqlite/text@1': { readonly output: 'sqlite/text@1'; readonly nullable: true };
    };
  };
  readonly min: {
    readonly byCodec: {
      readonly 'sql/char@1': { readonly output: 'sql/char@1'; readonly nullable: true };
      readonly 'sql/float@1': { readonly output: 'sql/float@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sql/int@1'; readonly nullable: true };
      readonly 'sql/varchar@1': { readonly output: 'sql/varchar@1'; readonly nullable: true };
      readonly 'sqlite/bigint@1': { readonly output: 'sqlite/bigint@1'; readonly nullable: true };
      readonly 'sqlite/bigintnumber@1': {
        readonly output: 'sqlite/bigintnumber@1';
        readonly nullable: true;
      };
      readonly 'sqlite/blob@1': { readonly output: 'sqlite/blob@1'; readonly nullable: true };
      readonly 'sqlite/datetime@1': {
        readonly output: 'sqlite/datetime@1';
        readonly nullable: true;
      };
      readonly 'sqlite/integer@1': { readonly output: 'sqlite/integer@1'; readonly nullable: true };
      readonly 'sqlite/json@1': { readonly output: 'sqlite/json@1'; readonly nullable: true };
      readonly 'sqlite/real@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sqlite/text@1': { readonly output: 'sqlite/text@1'; readonly nullable: true };
    };
  };
  readonly sum: {
    readonly byCodec: {
      readonly 'sql/float@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
      readonly 'sql/int@1': { readonly output: 'sqlite/bigintnumber@1'; readonly nullable: true };
      readonly 'sqlite/bigint@1': {
        readonly output: 'sqlite/bigintnumber@1';
        readonly nullable: true;
      };
      readonly 'sqlite/bigintnumber@1': {
        readonly output: 'sqlite/bigintnumber@1';
        readonly nullable: true;
      };
      readonly 'sqlite/integer@1': {
        readonly output: 'sqlite/bigintnumber@1';
        readonly nullable: true;
      };
      readonly 'sqlite/real@1': { readonly output: 'sqlite/real@1'; readonly nullable: true };
    };
  };
  readonly sumBigInt: {
    readonly byCodec: {
      readonly 'sql/int@1': { readonly output: 'sqlite/bigint@1'; readonly nullable: true };
      readonly 'sqlite/bigint@1': { readonly output: 'sqlite/bigint@1'; readonly nullable: true };
      readonly 'sqlite/bigintnumber@1': {
        readonly output: 'sqlite/bigint@1';
        readonly nullable: true;
      };
      readonly 'sqlite/integer@1': { readonly output: 'sqlite/bigint@1'; readonly nullable: true };
    };
  };
};
