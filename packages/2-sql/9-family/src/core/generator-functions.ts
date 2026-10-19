import type {
  GeneratorFunctionBinding,
  GeneratorFunctionColumn,
  GeneratorFunctionContribution,
  GeneratorResolution,
} from '@internal/framework-components/control';
import { singleGeneratorBinding } from '@internal/framework-components/control';
import type { FuncCallSig } from '@internal/psl-parser';
import { int, num, oneOf, optional } from '@internal/psl-parser';

const SQL_CHAR_CODEC_ID = 'sql/char@1';
const SQL_VARCHAR_CODEC_ID = 'sql/varchar@1';
const SQL_TEXT_CODEC_ID = 'sql/text@1';
const NANOID_DEFAULT_SIZE = 21;
const NANOID_MIN_SIZE = 2;
const NANOID_MAX_SIZE = 255;

const nowSignature: FuncCallSig = {
  documentation: "Writes the current time, as the column's codec represents it.",
};
const uuidSignature: FuncCallSig = {
  documentation: 'Generates a UUID when a value is not supplied.',
  positional: [
    {
      key: 'version',
      type: optional(oneOf(num(4), num(7))),
      documentation: 'The UUID version: `4` or `7`. Defaults to `4`.',
    },
  ],
};
const cuidSignature: FuncCallSig = {
  documentation: 'Generates a CUID2 identifier when a value is not supplied.',
  positional: [
    { key: 'version', type: num(2), documentation: 'The CUID version. Only `2` is supported.' },
  ],
};
const ulidSignature: FuncCallSig = {
  documentation: 'Generates a ULID when a value is not supplied.',
};
const nanoidSignature: FuncCallSig = {
  documentation: 'Generates a Nano ID when a value is not supplied.',
  positional: [
    {
      key: 'size',
      type: optional(int({ min: NANOID_MIN_SIZE, max: NANOID_MAX_SIZE })),
      documentation:
        "The identifier length, from `2` through `255`. Omit to use the column's length on a fixed-length column, or 21 otherwise.",
    },
  ],
};
const ksuidSignature: FuncCallSig = {
  documentation: 'Generates a KSUID when a value is not supplied.',
};

function refused(message: string): GeneratorResolution {
  return { ok: false, message };
}

function generated(id: string, params?: Readonly<Record<string, unknown>>): GeneratorResolution {
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

function columnLength(column: GeneratorFunctionColumn): number | undefined {
  const length = column.typeParams?.['length'];
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

function nanoidSizeRefusal(size: unknown): GeneratorResolution {
  return refused(
    `nanoid takes a size from ${NANOID_MIN_SIZE} through ${NANOID_MAX_SIZE}, not ${String(size)}.`,
  );
}

function nanoidGenerator(size: number, explicit: boolean): GeneratorResolution {
  return explicit || size !== NANOID_DEFAULT_SIZE
    ? generated('nanoid', { size })
    : generated('nanoid');
}

function fixedLengthNanoidBinding(codecIds: readonly string[]): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: ['nanoid'],
    resolve: ({ args, column }) => {
      const explicit = args['size'];
      const length = columnLength(column);
      if (explicit !== undefined) {
        if (!isNanoidSize(explicit)) return nanoidSizeRefusal(explicit);
        if (length !== undefined && explicit !== length) {
          return refused(
            `nanoid(${explicit}) on a Char(${length}) column would be padded with spaces; write nanoid() or nanoid(${length}).`,
          );
        }
        return nanoidGenerator(explicit, true);
      }
      const size = length ?? NANOID_DEFAULT_SIZE;
      return isNanoidSize(size) ? nanoidGenerator(size, false) : nanoidSizeRefusal(size);
    },
    printArguments: (generator, column) => {
      if (generator.id !== 'nanoid') return undefined;
      const size = generator.params?.['size'];
      const length = columnLength(column);
      if (typeof size === 'number' && (size !== length || size === NANOID_DEFAULT_SIZE)) {
        return { args: { size }, text: String(size) };
      }
      return { args: {}, text: '' };
    },
  };
}

function variableLengthNanoidBinding(codecIds: readonly string[]): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: ['nanoid'],
    resolve: ({ args, column }) => {
      const explicit = args['size'];
      if (explicit !== undefined && !isNanoidSize(explicit)) return nanoidSizeRefusal(explicit);
      const size = explicit ?? NANOID_DEFAULT_SIZE;
      const length = columnLength(column);
      if (length !== undefined && size > length) {
        const call = explicit === undefined ? 'nanoid()' : `nanoid(${size})`;
        return refused(
          `${call} writes ${size} characters, more than the VarChar(${length}) column holds.`,
        );
      }
      return nanoidGenerator(size, explicit !== undefined);
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

/** The identifier generator functions bound to a target's text-like and uuid codecs. */
export function idGeneratorFunctionBindings(codecs: {
  readonly fixedLength: readonly string[];
  readonly variableLength: readonly string[];
  readonly uuid?: readonly string[];
}): readonly GeneratorFunctionContribution[] {
  const text = [...codecs.fixedLength, ...codecs.variableLength];
  return [
    { name: 'uuid', bindings: [uuidBinding([...text, ...(codecs.uuid ?? [])])] },
    { name: 'cuid', bindings: [cuidBinding(text)] },
    { name: 'ulid', bindings: [singleGeneratorBinding({ codecIds: text, generatorId: 'ulid' })] },
    { name: 'ksuid', bindings: [singleGeneratorBinding({ codecIds: text, generatorId: 'ksuid' })] },
    {
      name: 'nanoid',
      bindings: [
        ...(codecs.fixedLength.length > 0 ? [fixedLengthNanoidBinding(codecs.fixedLength)] : []),
        ...(codecs.variableLength.length > 0
          ? [variableLengthNanoidBinding(codecs.variableLength)]
          : []),
      ],
    },
  ];
}

const familyIdBindings = idGeneratorFunctionBindings({
  fixedLength: [SQL_CHAR_CODEC_ID],
  variableLength: [SQL_VARCHAR_CODEC_ID, SQL_TEXT_CODEC_ID],
});

function familyBindingsOf(name: string): readonly GeneratorFunctionBinding[] {
  return familyIdBindings.find((contribution) => contribution.name === name)?.bindings ?? [];
}

/** The generator functions the SQL family declares, with their bindings to the family's codecs. Targets bind `now` and their own codecs. */
export const sqlFamilyGeneratorFunctions: readonly GeneratorFunctionContribution[] = [
  { name: 'now', signature: nowSignature, bindings: [] },
  { name: 'uuid', signature: uuidSignature, bindings: familyBindingsOf('uuid') },
  { name: 'cuid', signature: cuidSignature, bindings: familyBindingsOf('cuid') },
  { name: 'ulid', signature: ulidSignature, bindings: familyBindingsOf('ulid') },
  { name: 'nanoid', signature: nanoidSignature, bindings: familyBindingsOf('nanoid') },
  { name: 'ksuid', signature: ksuidSignature, bindings: familyBindingsOf('ksuid') },
];
