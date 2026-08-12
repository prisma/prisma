import { describe, expect, it, vi } from 'vitest';
import { MigrationToolsError } from '../src/errors';
import { planAllSpaces, type SpacePlanInput } from '../src/plan-all-spaces';

interface FakeContract {
  readonly hash: string;
}
type FakePackage = { readonly id: string };

const makeInput = (
  spaceId: string,
  newHash: string,
  priorHash: string | null = null,
): SpacePlanInput<FakeContract> => ({
  spaceId,
  newContract: { hash: newHash },
  priorContract: priorHash !== null ? { hash: priorHash } : null,
});

const planSpace = (input: SpacePlanInput<FakeContract>): readonly FakePackage[] => [
  { id: `${input.spaceId}->${input.newContract.hash}` },
];

describe('planAllSpaces', () => {
  it('returns one output per input, paired with the same spaceId', () => {
    const result = planAllSpaces(
      [makeInput('app', 'h-app'), makeInput('cipherstash', 'h-cipher')],
      planSpace,
    );

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.spaceId)).toEqual(['app', 'cipherstash']);
  });

  it('sorts outputs alphabetically by spaceId regardless of input order (AM3)', () => {
    const order1 = planAllSpaces(
      [makeInput('cipherstash', 'h1'), makeInput('app', 'h2'), makeInput('pgvector', 'h3')],
      planSpace,
    );
    const order2 = planAllSpaces(
      [makeInput('app', 'h2'), makeInput('pgvector', 'h3'), makeInput('cipherstash', 'h1')],
      planSpace,
    );
    const order3 = planAllSpaces(
      [makeInput('pgvector', 'h3'), makeInput('cipherstash', 'h1'), makeInput('app', 'h2')],
      planSpace,
    );

    expect(order1.map((r) => r.spaceId)).toEqual(['app', 'cipherstash', 'pgvector']);
    expect(order2).toEqual(order1);
    expect(order3).toEqual(order1);
  });

  it('passes the prior + new contract through to planSpace unchanged', () => {
    const calls: SpacePlanInput<FakeContract>[] = [];
    const captured = (input: SpacePlanInput<FakeContract>): readonly FakePackage[] => {
      calls.push(input);
      return [];
    };

    planAllSpaces(
      [
        makeInput('app', 'h-app-new', 'h-app-prior'),
        makeInput('cipherstash', 'h-cipher-new', null),
      ],
      captured,
    );

    expect(calls).toEqual([
      {
        spaceId: 'app',
        priorContract: { hash: 'h-app-prior' },
        newContract: { hash: 'h-app-new' },
      },
      {
        spaceId: 'cipherstash',
        priorContract: null,
        newContract: { hash: 'h-cipher-new' },
      },
    ]);
  });

  it('returns an empty array unchanged (no calls to planSpace)', () => {
    const planSpaceSpy = vi.fn(planSpace);
    const result = planAllSpaces([], planSpaceSpy);
    expect(result).toEqual([]);
    expect(planSpaceSpy).not.toHaveBeenCalled();
  });

  it("preserves today's single-app behaviour when only the app space is supplied", () => {
    const result = planAllSpaces([makeInput('app', 'h-app')], planSpace);
    expect(result).toEqual([{ spaceId: 'app', migrationPackages: [{ id: 'app->h-app' }] }]);
  });

  it('attaches whatever migrationPackages planSpace returns (zero, one, or many)', () => {
    const variable = (input: SpacePlanInput<FakeContract>): readonly FakePackage[] => {
      if (input.spaceId === 'app') return [];
      if (input.spaceId === 'cipherstash') return [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      return [{ id: 'one' }];
    };

    const result = planAllSpaces(
      [makeInput('app', 'h'), makeInput('cipherstash', 'h'), makeInput('pgvector', 'h')],
      variable,
    );

    expect(result.find((r) => r.spaceId === 'app')?.migrationPackages).toEqual([]);
    expect(result.find((r) => r.spaceId === 'cipherstash')?.migrationPackages).toHaveLength(3);
    expect(result.find((r) => r.spaceId === 'pgvector')?.migrationPackages).toHaveLength(1);
  });

  it('rejects duplicate spaceIds with MIGRATION.DUPLICATE_SPACE_ID before any planSpace call runs', () => {
    const planSpaceSpy = vi.fn(planSpace);
    let captured: unknown;
    try {
      planAllSpaces(
        [makeInput('app', 'h1'), makeInput('cipherstash', 'h2'), makeInput('app', 'h3')],
        planSpaceSpy,
      );
    } catch (error) {
      captured = error;
    }

    expect(MigrationToolsError.is(captured)).toBe(true);
    const err = captured as MigrationToolsError;
    expect(err.code).toBe('MIGRATION.DUPLICATE_SPACE_ID');
    expect(err.why).toContain('"app"');
    expect(planSpaceSpy).not.toHaveBeenCalled();
  });

  it('does not mutate the input array', () => {
    const inputs = [
      makeInput('cipherstash', 'h1'),
      makeInput('app', 'h2'),
      makeInput('pgvector', 'h3'),
    ];
    const snapshot = inputs.map((i) => i.spaceId);
    planAllSpaces(inputs, planSpace);
    expect(inputs.map((i) => i.spaceId)).toEqual(snapshot);
  });
});
