import type { ExecutionMutationDefaultValue } from '@internal/contract/types';
import type { ColumnTypeDescriptor } from '@internal/framework-components/codec';
import { ifDefined } from '@internal/utils/defined';
import { contractError } from './contract-errors';
import { type BuiltinGeneratorId, builtinGeneratorIds } from './generator-ids';
import type { IdGeneratorOptionsById } from './generators';

export { builtinGeneratorIds };

const GENERATED_CHAR_TYPE = { codecId: 'sql/char@1' } as const;

/**
 * The explicit storage a generator's TS spec helper bundles: a `character(N)`
 * type sized to the generator's output. Calling a helper *is* an explicit
 * storage request (the storage is part of the helper's contract), unlike a
 * PSL `@default(<generator>)`, which never influences the field's storage
 * type — the PSL interpreter never consults this metadata.
 */
type GeneratedStorage<Length extends number = number> = {
  readonly type: ColumnTypeDescriptor<typeof GENERATED_CHAR_TYPE.codecId>;
  readonly typeParams: { readonly length: Length };
};

function charStorage<const Length extends number>(length: Length): GeneratedStorage<Length> {
  return { type: GENERATED_CHAR_TYPE, typeParams: { length } };
}

const NANOID_DEFAULT_SIZE = 21;

type NanoidOptions = IdGeneratorOptionsById['nanoid'];

function nanoidStorage(): GeneratedStorage<typeof NANOID_DEFAULT_SIZE>;
function nanoidStorage<const Size extends number>(options: {
  readonly size: Size;
}): GeneratedStorage<Size>;
function nanoidStorage(options?: NanoidOptions): GeneratedStorage;
function nanoidStorage(options?: NanoidOptions): GeneratedStorage {
  const rawSize: unknown = options?.size;
  if (rawSize === undefined) {
    return charStorage(NANOID_DEFAULT_SIZE);
  }
  if (typeof rawSize !== 'number' || !Number.isInteger(rawSize) || rawSize < 2 || rawSize > 255) {
    throw contractError(
      'CONTRACT.ARGUMENT_INVALID',
      'nanoid size must be an integer between 2 and 255',
      { meta: { helperPath: 'nanoid', paramName: 'size', received: rawSize } },
    );
  }
  return charStorage(rawSize);
}

type BuiltinGeneratorMetadata = {
  readonly applicableCodecIds: readonly string[];
  /** The single source of the {@link GeneratedStorage} this generator's TS spec helper bundles, in its value and in its type. */
  readonly generatedStorage: (options?: never) => GeneratedStorage;
};

const builtinGeneratorMetadataById = {
  ulid: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1'],
    generatedStorage: () => charStorage(26),
  },
  nanoid: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1'],
    generatedStorage: nanoidStorage,
  },
  uuidv7: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1', 'pg/uuid@1'],
    generatedStorage: () => charStorage(36),
  },
  uuidv4: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1', 'pg/uuid@1'],
    generatedStorage: () => charStorage(36),
  },
  cuid2: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1'],
    generatedStorage: () => charStorage(24),
  },
  ksuid: {
    applicableCodecIds: ['pg/text@1', 'sql/char@1'],
    generatedStorage: () => charStorage(27),
  },
} as const satisfies Record<BuiltinGeneratorId, BuiltinGeneratorMetadata>;

export const builtinGeneratorRegistryMetadata: ReadonlyArray<{
  readonly id: BuiltinGeneratorId;
  readonly applicableCodecIds: readonly string[];
}> = builtinGeneratorIds.map((id) => ({
  id,
  applicableCodecIds: builtinGeneratorMetadataById[id].applicableCodecIds,
}));

export type GeneratedColumnSpec<TCodecId extends string = string> = {
  readonly type: ColumnTypeDescriptor<TCodecId>;
  readonly nullable?: false;
  readonly typeParams?: Record<string, unknown>;
  readonly generated: ExecutionMutationDefaultValue;
};

function createGeneratedSpec<TId extends BuiltinGeneratorId, Length extends number>(
  id: TId,
  storage: GeneratedStorage<Length>,
  options: IdGeneratorOptionsById[TId] | undefined,
) {
  const params = options as Record<string, unknown> | undefined;
  const generated: ExecutionMutationDefaultValue = {
    kind: 'generator',
    id,
    ...ifDefined('params', params),
  };
  return {
    type: storage.type,
    nullable: false,
    typeParams: storage.typeParams,
    generated,
  } as const;
}

export const ulid = (options?: IdGeneratorOptionsById['ulid']) =>
  createGeneratedSpec('ulid', builtinGeneratorMetadataById.ulid.generatedStorage(), options);
export const uuidv7 = (options?: IdGeneratorOptionsById['uuidv7']) =>
  createGeneratedSpec('uuidv7', builtinGeneratorMetadataById.uuidv7.generatedStorage(), options);
export const uuidv4 = (options?: IdGeneratorOptionsById['uuidv4']) =>
  createGeneratedSpec('uuidv4', builtinGeneratorMetadataById.uuidv4.generatedStorage(), options);
export const cuid2 = (options?: IdGeneratorOptionsById['cuid2']) =>
  createGeneratedSpec('cuid2', builtinGeneratorMetadataById.cuid2.generatedStorage(), options);
export const ksuid = (options?: IdGeneratorOptionsById['ksuid']) =>
  createGeneratedSpec('ksuid', builtinGeneratorMetadataById.ksuid.generatedStorage(), options);

export function nanoid(): ReturnType<
  typeof createGeneratedSpec<'nanoid', typeof NANOID_DEFAULT_SIZE>
>;
export function nanoid<const Size extends number>(options: {
  readonly size: Size;
}): ReturnType<typeof createGeneratedSpec<'nanoid', Size>>;
export function nanoid(
  options?: NanoidOptions,
): ReturnType<typeof createGeneratedSpec<'nanoid', number>>;
export function nanoid(options?: NanoidOptions) {
  return createGeneratedSpec(
    'nanoid',
    builtinGeneratorMetadataById.nanoid.generatedStorage(options),
    options,
  );
}
