import { describe, expect, it } from 'vitest';
import { assembleControlMutationDefaults } from '../src/control/control-stack';
import type { ControlMutationDefaultEntry } from '../src/shared/mutation-default-types';

const stubLower: ControlMutationDefaultEntry['lower'] = () => ({
  ok: true,
  value: { kind: 'storage', defaultValue: { kind: 'literal', value: 0 } },
});

function contributor(
  id: string,
  functions: ReadonlyArray<readonly [string, ControlMutationDefaultEntry]>,
  generatorIds: readonly string[] = [],
) {
  return {
    id,
    controlMutationDefaults: {
      defaultFunctionRegistry: new Map(functions),
      generatorDescriptors: generatorIds.map((generatorId) => ({ id: generatorId })),
    },
  };
}

describe('assembleControlMutationDefaults lifted calls', () => {
  it('returns the default function that lifts each generator', () => {
    const liftUuid = () => '';
    const liftNanoid = () => '21';
    const assembled = assembleControlMutationDefaults([
      contributor(
        'adapter',
        [['uuid', { lower: stubLower, liftArguments: { uuidv4: liftUuid } }]],
        ['uuidv4', 'nanoid'],
      ),
      contributor('extension', [
        ['nanoid', { lower: stubLower, liftArguments: { nanoid: liftNanoid } }],
        ['now', { lower: stubLower }],
      ]),
    ]);
    expect(assembled.callsByGenerator).toEqual(
      new Map([
        ['uuidv4', { functionName: 'uuid', liftArguments: liftUuid }],
        ['nanoid', { functionName: 'nanoid', liftArguments: liftNanoid }],
      ]),
    );
  });

  it('throws when two functions from different descriptors lift one generator', () => {
    expect(() =>
      assembleControlMutationDefaults([
        contributor(
          'desc-a',
          [['uuid', { lower: stubLower, liftArguments: { uuidv4: () => '' } }]],
          ['uuidv4'],
        ),
        contributor('desc-b', [
          ['guid', { lower: stubLower, liftArguments: { uuidv4: () => '' } }],
        ]),
      ]),
    ).toThrow(
      'Duplicate PSL call for mutation default generator "uuidv4". Function "guid" from "desc-b" conflicts with function "uuid" from "desc-a".',
    );
  });

  it('throws when two functions from one descriptor lift one generator', () => {
    expect(() =>
      assembleControlMutationDefaults([
        contributor(
          'desc-a',
          [
            ['uuid', { lower: stubLower, liftArguments: { uuidv4: () => '' } }],
            ['guid', { lower: stubLower, liftArguments: { uuidv4: () => '' } }],
          ],
          ['uuidv4'],
        ),
      ]),
    ).toThrow(
      'Duplicate PSL call for mutation default generator "uuidv4". Function "guid" from "desc-a" conflicts with function "uuid" from "desc-a".',
    );
  });

  it('throws when a function lifts a generator no descriptor registers', () => {
    expect(() =>
      assembleControlMutationDefaults([
        contributor(
          'desc-a',
          [['slugid', { lower: stubLower, liftArguments: { slugId: () => '' } }]],
          ['slugid'],
        ),
      ]),
    ).toThrow(
      'Mutation default function "slugid" from "desc-a" writes a PSL call for generator "slugId", which no generator descriptor in the stack registers.',
    );
  });
});
