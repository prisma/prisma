import { cuid2 as cuid2Generator } from 'uniku/cuid2';
import { ksuid as ksuidGenerator } from 'uniku/ksuid';
import { nanoid as nanoidGenerator } from 'uniku/nanoid';
import { ulid as ulidGenerator } from 'uniku/ulid';
import { uuidv4 as uuidv4Generator } from 'uniku/uuid/v4';
import { uuidv7 as uuidv7Generator } from 'uniku/uuid/v7';
import type { BuiltinGeneratorId } from './generator-ids';

type FirstArg<TFunction> = TFunction extends (...args: infer TArgs) => unknown
  ? TArgs extends []
    ? undefined
    : TArgs[0]
  : never;

export type IdGeneratorOptionsById = {
  readonly ulid: FirstArg<typeof ulidGenerator>;
  readonly nanoid: FirstArg<typeof nanoidGenerator>;
  readonly uuidv7: FirstArg<typeof uuidv7Generator>;
  readonly uuidv4: FirstArg<typeof uuidv4Generator>;
  readonly cuid2: FirstArg<typeof cuid2Generator>;
  readonly ksuid: FirstArg<typeof ksuidGenerator>;
};

type IdGenerator = (params?: Record<string, unknown>) => string;

function invokeGenerator<TOptions>(
  generator: (options?: TOptions) => string,
  params?: Record<string, unknown>,
): string {
  if (params === undefined) {
    return generator();
  }
  return generator(params as TOptions);
}

export const idGenerators = {
  ulid: (params?: Record<string, unknown>) => invokeGenerator(ulidGenerator, params),
  nanoid: (params?: Record<string, unknown>) => invokeGenerator(nanoidGenerator, params),
  uuidv7: (params?: Record<string, unknown>) => invokeGenerator(uuidv7Generator, params),
  uuidv4: (params?: Record<string, unknown>) => invokeGenerator(uuidv4Generator, params),
  cuid2: (params?: Record<string, unknown>) => invokeGenerator(cuid2Generator, params),
  ksuid: (params?: Record<string, unknown>) => invokeGenerator(ksuidGenerator, params),
} as const satisfies Record<BuiltinGeneratorId, IdGenerator>;
