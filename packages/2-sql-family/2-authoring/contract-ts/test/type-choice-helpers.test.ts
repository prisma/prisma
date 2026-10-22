import { describe, expect, it } from 'vitest';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { familyPack, targetPack } from './helpers/type-choice-packs';

const { type } = createComposedAuthoringHelpers({
  ...testTypeLookups,
  family: familyPack,
  target: targetPack,
});

describe('a type.* helper of a type choice', () => {
  it('gives what the helper of the type it chooses gives, for each row', () => {
    expect({
      bare: type.Moment(),
      local: type.Moment('temporal', 'local', 6),
      string: type.Moment('string', 'local'),
      day: type.Day(),
      temporalDay: type.Day('temporal'),
    }).toEqual({
      bare: type.TimestamptzTemporal(3),
      local: type.TimestampTemporal(6),
      string: type.TimestampString(),
      day: type.DateString(),
      temporalDay: type.DateTemporal(),
    });
  });

  it('gives the explicit codec and parameters', () => {
    expect(type.Moment()).toEqual({
      kind: 'codec-instance',
      codecId: 'pg/timestamptz-temporal@1',
      typeParams: { precision: 3 },
    });
  });

  it('refuses an unlisted combination at the argument that makes it invalid', () => {
    const untyped = type.Moment as (...args: readonly unknown[]) => unknown;
    expect(() => untyped('string')).toThrow(
      'Argument "column" of Moment cannot be tz when value is string; write one of: local.',
    );
  });
});

describe('composing helpers for a pack with a type choice', () => {
  it('refuses a choice naming a constructor no pack registers', () => {
    const broken = {
      ...targetPack,
      authoring: {
        type: {
          Moment: {
            ...targetPack.authoring.type.Moment,
            choices: [{ when: { value: 'temporal', column: 'tz' }, type: 'Missing' }],
          },
        },
      },
    } as const;
    expect(() =>
      createComposedAuthoringHelpers({ ...testTypeLookups, family: familyPack, target: broken }),
    ).toThrow(/Type choice "Moment" contributed by "postgres" chooses "Missing"/);
  });
});
