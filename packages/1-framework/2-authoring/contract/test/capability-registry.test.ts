import { describe, expect, it } from 'vitest';
import { type CapabilityMatrix, mergeCapabilityMatrices } from '../src/capability-registry';

describe('mergeCapabilityMatrices', () => {
  it('returns an empty matrix when no sources are provided', () => {
    expect(mergeCapabilityMatrices()).toEqual({});
  });

  it('ignores undefined sources', () => {
    expect(mergeCapabilityMatrices(undefined, undefined)).toEqual({});
  });

  it('passes a single matrix through unchanged', () => {
    const source: CapabilityMatrix = { ns: { a: true, b: false } };
    expect(mergeCapabilityMatrices(source)).toEqual({ ns: { a: true, b: false } });
  });

  it('merges flags from multiple namespaces', () => {
    expect(mergeCapabilityMatrices({ alpha: { a: true } }, { beta: { b: true } })).toEqual({
      alpha: { a: true },
      beta: { b: true },
    });
  });

  it('overlays flags within a namespace, later wins', () => {
    expect(
      mergeCapabilityMatrices({ ns: { a: true, b: true } }, { ns: { b: false, c: true } }),
    ).toEqual({ ns: { a: true, b: false, c: true } });
  });

  it('preserves earlier-namespace flags when later sources add to it', () => {
    expect(
      mergeCapabilityMatrices({ ns: { a: true } }, { other: { x: true } }, { ns: { b: true } }),
    ).toEqual({ ns: { a: true, b: true }, other: { x: true } });
  });

  it('does not mutate input matrices', () => {
    const left: CapabilityMatrix = { ns: { a: true } };
    const right: CapabilityMatrix = { ns: { b: true } };
    mergeCapabilityMatrices(left, right);
    expect(left).toEqual({ ns: { a: true } });
    expect(right).toEqual({ ns: { b: true } });
  });
});
