import type {
  BindingResolution,
  GeneratorFunctionBinding,
  GeneratorFunctionContribution,
  GeneratorFunctionField,
} from '@internal/framework-components/components';
import { singleGeneratorBinding } from '@internal/framework-components/components';
import type { FuncCallSig } from '@internal/psl-parser';
import { int, num, oneOf, optional } from '@internal/psl-parser';
import {
  SQL_CHAR_CODEC_ID,
  SQL_TEXT_CODEC_ID,
  SQL_VARCHAR_CODEC_ID,
} from '@internal/sql-relational-core/ast';

const NANOID_DEFAULT_SIZE = 21;
const NANOID_MIN_SIZE = 2;
const NANOID_MAX_SIZE = 255;

const nowSignature = {
  documentation: "Writes the current time, as the column's codec represents it.",
} as const satisfies FuncCallSig;
const uuidSignature = {
  documentation: 'Generates a UUID when a value is not supplied.',
  positional: [
    {
      key: 'version',
      type: optional(oneOf(num(4), num(7))),
      documentation: 'The UUID version: `4` or `7`. Defaults to `4`.',
    },
  ],
} as const satisfies FuncCallSig;
const cuidSignature = {
  documentation: 'Generates a CUID2 identifier when a value is not supplied.',
  positional: [
    { key: 'version', type: num(2), documentation: 'The CUID version. Only `2` is supported.' },
  ],
} as const satisfies FuncCallSig;
const ulidSignature = {
  documentation: 'Generates a ULID when a value is not supplied.',
} as const satisfies FuncCallSig;
const nanoidSignature = {
  documentation: 'Generates a Nano ID when a value is not supplied.',
  positional: [
    {
      key: 'size',
      type: optional(int({ min: NANOID_MIN_SIZE, max: NANOID_MAX_SIZE })),
      documentation: 'The identifier length, from `2` through `255`. Defaults to 21.',
    },
  ],
} as const satisfies FuncCallSig;
const ksuidSignature = {
  documentation: 'Generates a KSUID when a value is not supplied.',
} as const satisfies FuncCallSig;

function refused(message: string): BindingResolution {
  return { ok: false, message };
}

function generated(id: string, params?: Readonly<Record<string, unknown>>): BindingResolution {
  return {
    ok: true,
    generator: params === undefined ? { kind: 'generator', id } : { kind: 'generator', id, params },
  };
}

function uuidBinding(codecIds: readonly string[]): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: ['uuidv4', 'uuidv7'],
    resolve: ({ args }) => {
      const version = args['version'];
      if (version === undefined || version === 4) return generated('uuidv4');
      if (version === 7) return generated('uuidv7');
      return refused(`uuid takes version 4 or 7, not ${String(version)}.`);
    },
    printArguments: (generator) => {
      if (generator.id === 'uuidv4') return { args: {}, text: '' };
      if (generator.id === 'uuidv7') return { args: { version: 7 }, text: '7' };
      return undefined;
    },
  };
}

function cuidBinding(codecIds: readonly string[]): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: ['cuid2'],
    resolve: ({ args }) => {
      const version = args['version'];
      return version === 2
        ? generated('cuid2')
        : refused(`cuid takes version 2, not ${String(version)}.`);
    },
    printArguments: (generator) =>
      generator.id === 'cuid2' ? { args: { version: 2 }, text: '2' } : undefined,
  };
}

function columnLength(field: GeneratorFunctionField): number | undefined {
  const length = field.typeParams?.['length'];
  return typeof length === 'number' ? length : undefined;
}

function isNanoidSize(size: unknown): size is number {
  return (
    typeof size === 'number' &&
    Number.isInteger(size) &&
    size >= NANOID_MIN_SIZE &&
    size <= NANOID_MAX_SIZE
  );
}

/**
 * A Nano ID has the size the call gives, or 21; the column's length never sets it. A size larger than the column's length is refused, since the identifier would not fit. A shorter identifier in a fixed-length column is padded by the database, as Prisma 7 does.
 */
function nanoidBinding(codecIds: readonly string[]): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: ['nanoid'],
    resolve: ({ args, field }) => {
      const explicit = args['size'];
      if (explicit !== undefined && !isNanoidSize(explicit)) {
        return refused(
          `nanoid takes a size from ${NANOID_MIN_SIZE} through ${NANOID_MAX_SIZE}, not ${String(explicit)}.`,
        );
      }
      const size = explicit ?? NANOID_DEFAULT_SIZE;
      const length = columnLength(field);
      if (length !== undefined && size > length) {
        const call = explicit === undefined ? 'nanoid()' : `nanoid(${size})`;
        return refused(
          `${call} writes ${size} characters, which does not fit a column of ${length} characters.`,
        );
      }
      return explicit === undefined ? generated('nanoid') : generated('nanoid', { size });
    },
    printArguments: (generator) => {
      if (generator.id !== 'nanoid') return undefined;
      const size = generator.params?.['size'];
      return typeof size === 'number'
        ? { args: { size }, text: String(size) }
        : { args: {}, text: '' };
    },
  };
}

/** The identifier generator functions bound to a target's text codecs, and `uuid` to its uuid codecs. */
export function idGeneratorFunctionBindings(codecs: {
  readonly text: readonly string[];
  readonly uuid?: readonly string[];
}): readonly GeneratorFunctionContribution[] {
  const { text } = codecs;
  return [
    { name: 'uuid', bindings: [uuidBinding([...text, ...(codecs.uuid ?? [])])] },
    { name: 'cuid', bindings: [cuidBinding(text)] },
    { name: 'ulid', bindings: [singleGeneratorBinding({ codecIds: text, generatorId: 'ulid' })] },
    {
      name: 'ksuid',
      bindings: [singleGeneratorBinding({ codecIds: text, generatorId: 'ksuid' })],
    },
    { name: 'nanoid', bindings: [nanoidBinding(text)] },
  ];
}

const familyIdBindings = idGeneratorFunctionBindings({
  text: [SQL_CHAR_CODEC_ID, SQL_VARCHAR_CODEC_ID, SQL_TEXT_CODEC_ID],
});

function familyBindingsOf(name: string): readonly GeneratorFunctionBinding[] {
  return familyIdBindings.find((contribution) => contribution.name === name)?.bindings ?? [];
}

/** The generator functions the SQL family declares, with their bindings to the family's codecs. Targets bind `now` and their own codecs. */
export const sqlFamilyGeneratorFunctions = [
  { name: 'now', signature: nowSignature, bindings: [] },
  { name: 'uuid', signature: uuidSignature, bindings: familyBindingsOf('uuid') },
  { name: 'cuid', signature: cuidSignature, bindings: familyBindingsOf('cuid') },
  { name: 'ulid', signature: ulidSignature, bindings: familyBindingsOf('ulid') },
  { name: 'nanoid', signature: nanoidSignature, bindings: familyBindingsOf('nanoid') },
  { name: 'ksuid', signature: ksuidSignature, bindings: familyBindingsOf('ksuid') },
] as const satisfies readonly GeneratorFunctionContribution[];
