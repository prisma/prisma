import { describe, expect, it } from 'vitest';
import { mongoEnumListabilityOf } from '../src/enum-listability';

describe('mongoEnumListabilityOf', () => {
  it('refuses a codec with more than one BSON type', () => {
    expect(mongoEnumListabilityOf(['int', 'long'])).toEqual({
      kind: 'refused',
      reason:
        'declares 2 BSON types; an enum needs exactly one. Use a codec with one BSON type, such as mongo/string@1.',
    });
  });

  it('refuses a codec that accepts any BSON value', () => {
    expect(mongoEnumListabilityOf([])).toMatchObject({ kind: 'refused' });
  });

  it('refuses a BSON type whose values JSON cannot hold', () => {
    expect(mongoEnumListabilityOf(['long'])).toEqual({
      kind: 'refused',
      reason:
        'stores BSON type long, which a collection validator cannot list as an enum value. Use a codec whose BSON type is string, int, double, bool, object or array.',
    });
  });

  describe('a listable BSON type', () => {
    const listability = mongoEnumListabilityOf(['int']);

    it('names the BSON type', () => {
      expect(listability).toMatchObject({ kind: 'listable', bsonType: 'int' });
    });

    it('accepts a member stored as the matching JSON type', () => {
      expect(listability.kind === 'listable' && listability.memberRefusalOf(3)).toBeUndefined();
    });

    it('refuses a member stored as another JSON type', () => {
      expect(listability.kind === 'listable' && listability.memberRefusalOf('3')).toBe(
        'is stored as "3", which a collection validator cannot list as a int. A member of a int enum must be a finite number.',
      );
    });
  });
});
