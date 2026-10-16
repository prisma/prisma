import { describe, expect, it } from 'vitest';
import { documentIdRefusalOf } from '../src/document-id-refusal';
import { mongoTypeLookups } from '../src/fake-type-lookups';
import { scalarField, voField } from './derive-json-schema-helpers';

const notObjectId = {
  kind: 'notObjectId',
  reason:
    'has no _id field stored as BSON type objectId. MongoDB adds an objectId _id to every document it inserts without one, so a collection validator without it rejects every insert.',
};

describe('documentIdRefusalOf', () => {
  it('accepts an _id stored as BSON type objectId', () => {
    expect(
      documentIdRefusalOf({ _id: scalarField('mongo/objectId@1') }, mongoTypeLookups),
    ).toBeUndefined();
  });

  it('refuses a model without an _id', () => {
    expect(documentIdRefusalOf({ email: scalarField('mongo/string@1') }, mongoTypeLookups)).toEqual(
      notObjectId,
    );
  });

  it('refuses an _id stored as another BSON type', () => {
    expect(documentIdRefusalOf({ _id: scalarField('mongo/string@1') }, mongoTypeLookups)).toEqual(
      notObjectId,
    );
  });

  it('names the codec of an _id whose codec has no MongoDB data type', () => {
    expect(documentIdRefusalOf({ _id: scalarField('unknown/codec@1') }, mongoTypeLookups)).toEqual({
      kind: 'unknownCodec',
      reason:
        'has an _id field whose codec "unknown/codec@1" has no MongoDB data type, so its BSON type is unknown.',
    });
  });

  it('refuses an _id holding a value object', () => {
    expect(documentIdRefusalOf({ _id: voField('Key') }, mongoTypeLookups)).toEqual(notObjectId);
  });
});
