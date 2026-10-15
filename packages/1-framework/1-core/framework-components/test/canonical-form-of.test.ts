import type { JsonValue } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { canonicalFormOf } from '../src/shared/codec-descriptor';
import { createDataTypeLookup, dataType, dataTypeId } from '../src/shared/data-type';

const trimmed = (value: JsonValue): JsonValue => String(value).trim();

const text = dataType('demo/text', { read: (json) => json });
const code = dataType('demo/code', { read: (json) => json, toCanonicalForm: trimmed });
const dataTypes = createDataTypeLookup([text, code]);

describe('canonicalFormOf', () => {
  it("takes the data type's canonical form", () => {
    const form = canonicalFormOf({ dataType: code.id }, dataTypes);
    expect(form?.(' ab ')).toBe('ab');
  });

  it('has none when the data type declares none', () => {
    expect({
      declaredByNone: canonicalFormOf({ dataType: text.id }, dataTypes),
      unregisteredType: canonicalFormOf({ dataType: dataTypeId('demo/gone') }, dataTypes),
    }).toEqual({ declaredByNone: undefined, unregisteredType: undefined });
  });
});
