import type { JsonValue } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import type { CodecLookupWithDescriptors } from '../src/shared/codec-types';
import { dataTypeId } from '../src/shared/data-type';
import { type DiscriminatorField, discriminatorRefusals } from '../src/shared/discriminator-rule';

const text = dataTypeId('t/text');
const int = dataTypeId('t/int');

const codecLookup: Pick<CodecLookupWithDescriptors, 'descriptorFor'> = {
  descriptorFor: (codecId) => {
    const dataType = { 't/text@1': text, 't/int@1': int }[codecId];
    return dataType === undefined
      ? undefined
      : {
          codecId,
          dataType,
          traits: ['equality'],
          paramsSchema: undefined,
          isParameterized: false,
          factory: () => () => {
            throw new Error('the rule builds no codec');
          },
        };
  },
};

const textField: DiscriminatorField = {
  ref: { codecId: 't/text@1' },
  nullable: false,
  many: false,
  enumMembers: undefined,
};

function refusals(
  field: DiscriminatorField,
  baseValues: readonly { readonly key: string; readonly stored: JsonValue }[] = [],
) {
  return discriminatorRefusals({ field, baseValues, codecLookup, textDataTypes: [text] });
}

describe('discriminatorRefusals', () => {
  it('accepts a required single text field, whatever its values', () => {
    expect(refusals(textField, [{ key: 'Photo', stored: 'photo' }])).toEqual([]);
  });

  it('refuses an optional field, a list and a field whose data type is not text', () => {
    expect(
      refusals({ ...textField, ref: { codecId: 't/int@1' }, nullable: true, many: true }),
    ).toEqual([
      { kind: 'optional' },
      { kind: 'list' },
      { kind: 'not-text', dataType: int, textDataTypes: [text] },
    ]);
  });

  it('refuses a field whose codec names no data type as not text', () => {
    expect(refusals({ ...textField, ref: { codecId: 't/unknown@1' } })).toEqual([
      { kind: 'not-text', dataType: undefined, textDataTypes: [text] },
    ]);
  });

  it('refuses each base value that is not a member of the field enum, naming its key', () => {
    expect(
      refusals({ ...textField, enumMembers: ['photo', 'video'] }, [
        { key: 'Photo', stored: 'photo' },
        { key: 'Audio', stored: 'audio' },
      ]),
    ).toEqual([
      { kind: 'not-a-member', key: 'Audio', stored: 'audio', members: ['photo', 'video'] },
    ]);
  });

  it('throws when the stack names no text data types, since no field could be a discriminator', () => {
    expect(() =>
      discriminatorRefusals({ field: textField, baseValues: [], codecLookup, textDataTypes: [] }),
    ).toThrow(expect.objectContaining({ name: 'InternalError' }));
  });
});
