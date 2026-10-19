import { describe, expect, it } from 'vitest';
import { documentIdRefusalOf } from '../src/document-id-refusal';
import { mongoTypeLookups } from '../src/fake-type-lookups';
import { arrayField, scalarField, voField } from './derive-json-schema-helpers';

const storedAs = (description: string) =>
  `holds the document id as ${description}, but an _id must be stored as BSON type objectId: every collection validator requires an objectId _id, which MongoDB adds to every document inserted without one.`;

describe('documentIdRefusalOf', () => {
  it('accepts an _id stored as BSON type objectId, by any codec', () => {
    expect([
      documentIdRefusalOf(scalarField('mongo/objectId@1'), mongoTypeLookups),
      documentIdRefusalOf(scalarField('custom/oid@2'), mongoTypeLookups),
    ]).toEqual([undefined, undefined]);
  });

  it.each([
    ['a string', scalarField('mongo/string@1'), 'BSON type string'],
    ['a date', scalarField('mongo/date@1'), 'BSON type date'],
    ['bytes', scalarField('mongo/binary@1'), 'BSON type binData'],
    ['any BSON value', scalarField('mongo/bson@1'), 'any BSON type'],
    ['several BSON types', scalarField('test/int-or-long@1'), 'BSON type int or long'],
    ['a nullable objectId', scalarField('mongo/objectId@1', true), 'BSON type null or objectId'],
    ['a list', arrayField('mongo/objectId@1'), 'an array'],
    ['a value object', voField('Key'), 'an object'],
  ])('refuses an _id stored as %s', (_case, field, description) => {
    expect(documentIdRefusalOf(field, mongoTypeLookups)).toBe(storedAs(description));
  });

  it('leaves an _id whose codec has no MongoDB data type to the field rule', () => {
    expect(documentIdRefusalOf(scalarField('unknown/codec@1'), mongoTypeLookups)).toBeUndefined();
  });
});
