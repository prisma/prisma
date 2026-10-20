import type { JsonValue } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import type { Codec } from '../src/shared/codec';
import { emptyCodecLookup } from '../src/shared/codec-types';
import { createDataTypeLookup, dataType } from '../src/shared/data-type';
import { readEnumBlockMembers } from '../src/shared/enum-block-members';
import type {
  AuthoringEntityContext,
  WrittenValueReading,
} from '../src/shared/framework-authoring';
import type { ParsedPslExtensionBlock } from '../src/shared/psl-extension-block';
import type { WrittenScalar } from '../src/shared/written-value';

const SPAN = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

/** Where the member at `index` is written: line `index + 2`, distinct from the block and every other member. */
function memberSpan(index: number) {
  return {
    start: { offset: 10 * (index + 1), line: index + 2, column: 3 },
    end: { offset: 10 * (index + 1) + 5, line: index + 2, column: 8 },
  };
}

function enumBlock(
  values: Record<string, JsonValue | undefined>,
): ParsedPslExtensionBlock<Readonly<Record<string, JsonValue | undefined>>> {
  return {
    kind: 'enum',
    keyword: 'enum',
    name: 'Key',
    values,
    parameterSpans: Object.fromEntries(
      Object.keys(values).map((key, index) => [key, memberSpan(index)]),
    ),
    attributes: {},
    span: SPAN,
  };
}

const textType = dataType('test/text', {
  read(json) {
    if (typeof json !== 'string') throw new Error(`expected text, got ${typeof json}`);
    return json;
  },
});

/** Reads any text unchanged and stores it in lower case, so two members can differ as read and store the same value. */
const lowerCasingCodec: Codec = {
  id: 'test/lower-casing@1',
  dataType: textType,
  toWire: async (v: unknown) => v,
  fromWire: async (w: unknown) => w,
  toDataTypeValue: (value) => textType.valueFrom(String(value).toLowerCase(), {}),
  fromDataTypeValue: (value) => value.value,
};

const anyJsonType = dataType('test/any-json', { read: (json) => json });

/** Reads any JSON value unchanged, as a JSON column's codec does. */
const anyJsonCodec: Codec = {
  id: 'test/any-json@1',
  dataType: anyJsonType,
  toWire: async (v: unknown) => v,
  fromWire: async (w: unknown) => w,
  toDataTypeValue: (value) => anyJsonType.valueFrom(value as JsonValue, {}),
  fromDataTypeValue: (value) => value.value,
};

function read(values: Record<string, JsonValue | undefined>, codec: Codec = lowerCasingCodec) {
  const diagnostics: unknown[] = [];
  const members = readEnumBlockMembers(enumBlock(values), codec.id, codec, {
    family: 'test',
    target: 'test',
    codecLookup: { ...emptyCodecLookup, descriptorFor: () => undefined },
    dataTypeLookup: createDataTypeLookup([]),
    sourceId: 'schema.prisma',
    diagnostics: { push: (d) => diagnostics.push(d) },
  });
  return { members, diagnostics };
}

describe('readEnumBlockMembers', () => {
  it('reads each member as its codec reads it, and a bare member from its name', () => {
    expect(read({ A: 'A0EE', B: '{b0ee}', c: undefined })).toEqual({
      members: [
        { name: 'A', value: 'A0EE' },
        { name: 'B', value: '{b0ee}' },
        { name: 'c', value: 'c' },
      ],
      diagnostics: [],
    });
  });

  it('refuses two members that store the same value, naming both, at the later member', () => {
    expect(read({ Upper: 'A0EE', Other: 'b0ee', Lower: 'a0ee' })).toEqual({
      members: undefined,
      diagnostics: [
        {
          code: 'PSL_ENUM_DUPLICATE_MEMBER_VALUE',
          message: 'enum "Key": members "Upper" and "Lower" both store "a0ee"',
          sourceId: 'schema.prisma',
          span: memberSpan(2),
        },
      ],
    });
  });

  it('reports a member the codec refuses', () => {
    expect(read({ A: 1 })).toEqual({
      members: undefined,
      diagnostics: [
        {
          code: 'PSL_EXTENSION_INVALID_VALUE',
          message:
            'enum "Key" member "A" was rejected by codec "test/lower-casing@1": expected text, got number',
          sourceId: 'schema.prisma',
          span: memberSpan(0),
        },
      ],
    });
  });

  it('lets an error from storing a member it has read propagate, because that is a codec bug', () => {
    const failure = new TypeError('codec bug');
    const codec: Codec = {
      ...lowerCasingCodec,
      toDataTypeValue: () => {
        throw failure;
      },
    };
    expect(() =>
      readEnumBlockMembers(enumBlock({ A: 'a' }), 'test/lower-casing@1', codec, {
        family: 'test',
        target: 'test',
        codecLookup: { ...emptyCodecLookup, descriptorFor: () => undefined },
        dataTypeLookup: createDataTypeLookup([]),
      }),
    ).toThrow(failure);
  });

  it('reads each member as JSON through the codec when the family gives no reader for written members', () => {
    expect(
      readEnumBlockMembers(enumBlock({ Low: 1, Half: 1.5 }), anyJsonCodec.id, anyJsonCodec, {
        family: 'test',
        target: 'test',
        codecLookup: { ...emptyCodecLookup, descriptorFor: () => undefined },
        dataTypeLookup: createDataTypeLookup([]),
      }),
    ).toEqual([
      { name: 'Low', value: 1 },
      { name: 'Half', value: 1.5 },
    ]);
  });

  describe('with a family reader for written members', () => {
    function readWithReader(
      values: Record<string, JsonValue | undefined>,
      writtenValues: Record<string, WrittenScalar>,
      reading: (written: WrittenScalar) => WrittenValueReading | undefined,
      codec: Codec = lowerCasingCodec,
    ) {
      const diagnostics: unknown[] = [];
      const readerInputs: unknown[] = [];
      const ctx: AuthoringEntityContext = {
        family: 'test',
        target: 'test',
        codecLookup: { ...emptyCodecLookup, descriptorFor: () => undefined },
        dataTypeLookup: createDataTypeLookup([]),
        sourceId: 'schema.prisma',
        diagnostics: { push: (d) => diagnostics.push(d) },
        readWrittenValue: (input) => {
          readerInputs.push(input);
          return reading(input.written);
        },
      };
      const members = readEnumBlockMembers(
        { ...enumBlock(values), writtenValues },
        codec.id,
        codec,
        ctx,
      );
      return { members, diagnostics, readerInputs };
    }

    it('hands every member to the reader as it is written, and a bare member as its name in text', () => {
      expect(
        readWithReader(
          { Big: 9007199254740992, Text: 'T', Bare: undefined },
          {
            Big: { kind: 'number', text: '9007199254740993' },
            Text: { kind: 'string', text: 'T' },
          },
          (written) => ({ ok: true, value: written.kind === 'boolean' ? 'b' : written.text }),
        ),
      ).toEqual({
        members: [
          { name: 'Big', value: '9007199254740993' },
          { name: 'Text', value: 'T' },
          { name: 'Bare', value: 'Bare' },
        ],
        diagnostics: [],
        readerInputs: [
          {
            written: { kind: 'number', text: '9007199254740993' },
            codecId: 'test/lower-casing@1',
            subject: 'enum "Key" member "Big"',
          },
          {
            written: { kind: 'string', text: 'T' },
            codecId: 'test/lower-casing@1',
            subject: 'enum "Key" member "Text"',
          },
          {
            written: { kind: 'string', text: 'Bare' },
            codecId: 'test/lower-casing@1',
            subject: 'enum "Key" member "Bare"',
          },
        ],
      });
    });

    it('reports the reason the reader refuses a member, with its code, at the member', () => {
      expect(
        readWithReader({ Half: '0.5' }, { Half: { kind: 'string', text: '0.5' } }, () => ({
          ok: false,
          code: 'PSL_VALUE_TYPE_INCOMPATIBLE',
          message: 'enum "Key" member "Half": test/numeric has no cast from test/text',
        })),
      ).toMatchObject({
        members: undefined,
        diagnostics: [
          {
            code: 'PSL_VALUE_TYPE_INCOMPATIBLE',
            message: 'enum "Key" member "Half": test/numeric has no cast from test/text',
            sourceId: 'schema.prisma',
          },
        ],
      });
    });

    it('reports a bare member the reader refuses as a bare member', () => {
      expect(
        readWithReader({ Low: undefined }, {}, () => ({
          ok: false,
          code: 'PSL_VALUE_TYPE_INCOMPATIBLE',
          message: 'refused',
        })),
      ).toMatchObject({
        members: undefined,
        diagnostics: [{ code: 'PSL_ENUM_BARE_MEMBER_NON_STRING_CODEC' }],
      });
    });
  });

  it('reports an enum with no members', () => {
    expect(read({})).toEqual({
      members: undefined,
      diagnostics: [
        {
          code: 'PSL_ENUM_MISSING_TYPE',
          message: 'enum "Key" must have at least one member',
          sourceId: 'schema.prisma',
          span: SPAN,
        },
      ],
    });
  });
});
