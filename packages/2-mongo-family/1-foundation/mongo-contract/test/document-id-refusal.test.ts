import { describe, expect, it } from 'vitest';
import { documentIdRefusalOf } from '../src/document-id-refusal';
import { arrayField, scalarField, voField } from './derive-json-schema-helpers';

describe('documentIdRefusalOf', () => {
  it.each([
    ['an objectId', scalarField('mongo/objectId@1')],
    ['a string', scalarField('mongo/string@1')],
    ['an int', scalarField('mongo/int32@1')],
    ['a date', scalarField('mongo/date@1')],
    ['bytes', scalarField('mongo/binary@1')],
    ['any BSON value', scalarField('mongo/bson@1')],
    ['a value object', voField('Key')],
  ])('accepts an _id stored as %s', (_case, field) => {
    expect(documentIdRefusalOf(field)).toBeUndefined();
  });

  it('refuses a list _id', () => {
    expect(documentIdRefusalOf(arrayField('mongo/objectId@1'))).toEqual({
      problem: 'list',
      reason: 'holds the document id as a list, but MongoDB does not accept an array as an _id.',
    });
  });

  it('refuses a nullable _id', () => {
    expect(documentIdRefusalOf(scalarField('mongo/string@1', true))).toEqual({
      problem: 'nullable',
      reason: 'holds the document id as an optional value, but every document has an _id.',
    });
  });

  it('leaves an _id whose codec has no MongoDB data type to the field rule', () => {
    expect(documentIdRefusalOf(scalarField('unknown/codec@1'))).toBeUndefined();
  });
});
