/** A call of a generator function, resolved by the column's codec when the contract is built. */
export interface GeneratorCall {
  readonly kind: 'generator-call';
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

function call(name: string, args: Readonly<Record<string, unknown>> = {}): GeneratorCall {
  return { kind: 'generator-call', name, args };
}

/** The generator functions a TypeScript field passes to `.onCreate(...)` and `.onUpdate(...)`. Each takes the arguments of the PSL function of the same name. */
export const gen = {
  /** The current time, as the column's codec represents it. */
  now: (): GeneratorCall => call('now'),
  /** A UUID, version 4 unless `version` is 7. */
  uuid: (version?: 4 | 7): GeneratorCall => call('uuid', version === undefined ? {} : { version }),
  /** A CUID2 identifier. */
  cuid: (version: 2): GeneratorCall => call('cuid', { version }),
  /** A ULID. */
  ulid: (): GeneratorCall => call('ulid'),
  /** A Nano ID of `size` characters: the column's length on a fixed-length column, 21 otherwise. */
  nanoid: (size?: number): GeneratorCall => call('nanoid', size === undefined ? {} : { size }),
  /** A KSUID. */
  ksuid: (): GeneratorCall => call('ksuid'),
} as const;
