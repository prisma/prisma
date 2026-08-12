import { describe, expect, it } from 'vitest';
import {
  concatenateSpaceApplyInputs,
  type SpaceApplyInput,
} from '../src/concatenate-space-apply-inputs';

interface FakeOp {
  readonly id: string;
}

const makeInput = (
  spaceId: string,
  ops: readonly FakeOp[] = [{ id: `${spaceId}-op` }],
): SpaceApplyInput<FakeOp> => ({
  spaceId,
  migrationDirectory: `/repo/migrations/${spaceId === 'app' ? '' : spaceId}`,
  currentMarkerHash: null,
  currentMarkerInvariants: [],
  path: ops,
});

describe('concatenateSpaceApplyInputs', () => {
  it('puts the app-space input last', () => {
    const result = concatenateSpaceApplyInputs([
      makeInput('app'),
      makeInput('cipherstash'),
      makeInput('pgvector'),
    ]);

    expect(result.map((r) => r.spaceId)).toEqual(['cipherstash', 'pgvector', 'app']);
  });

  it('orders extension spaces alphabetically by spaceId', () => {
    const result = concatenateSpaceApplyInputs([
      makeInput('pgvector'),
      makeInput('cipherstash'),
      makeInput('audit'),
    ]);

    expect(result.map((r) => r.spaceId)).toEqual(['audit', 'cipherstash', 'pgvector']);
  });

  it('produces deterministic ordering regardless of declaration order', () => {
    const a = concatenateSpaceApplyInputs([
      makeInput('cipherstash'),
      makeInput('app'),
      makeInput('pgvector'),
    ]);
    const b = concatenateSpaceApplyInputs([
      makeInput('app'),
      makeInput('pgvector'),
      makeInput('cipherstash'),
    ]);
    const c = concatenateSpaceApplyInputs([
      makeInput('pgvector'),
      makeInput('cipherstash'),
      makeInput('app'),
    ]);

    const order = (xs: readonly SpaceApplyInput<FakeOp>[]) => xs.map((x) => x.spaceId);
    expect(order(a)).toEqual(['cipherstash', 'pgvector', 'app']);
    expect(order(b)).toEqual(order(a));
    expect(order(c)).toEqual(order(a));
  });

  it("handles a single app-space input (today's behaviour)", () => {
    const result = concatenateSpaceApplyInputs([makeInput('app')]);
    expect(result.map((r) => r.spaceId)).toEqual(['app']);
  });

  it('returns an empty array unchanged', () => {
    expect(concatenateSpaceApplyInputs([])).toEqual([]);
  });

  it('preserves each input verbatim (path arrays, marker fields, directory)', () => {
    const input = makeInput('cipherstash', [{ id: 'op-1' }, { id: 'op-2' }]);
    const result = concatenateSpaceApplyInputs([input]);
    expect(result[0]).toBe(input);
  });

  it('rejects duplicate spaceIds', () => {
    let captured: unknown;
    try {
      concatenateSpaceApplyInputs([makeInput('cipherstash'), makeInput('cipherstash')]);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as { code: string }).code).toBe('MIGRATION.DUPLICATE_SPACE_ID');
  });

  it('does not mutate the input array', () => {
    const inputs = [makeInput('pgvector'), makeInput('app'), makeInput('cipherstash')];
    const snapshot = inputs.map((i) => i.spaceId);
    concatenateSpaceApplyInputs(inputs);
    expect(inputs.map((i) => i.spaceId)).toEqual(snapshot);
  });

  it('tolerates input where there is no app-space entry (extensions-only)', () => {
    const result = concatenateSpaceApplyInputs([makeInput('pgvector'), makeInput('cipherstash')]);
    expect(result.map((r) => r.spaceId)).toEqual(['cipherstash', 'pgvector']);
  });
});
