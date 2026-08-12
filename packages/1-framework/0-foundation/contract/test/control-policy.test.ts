import { describe, expect, it } from 'vitest';
import { applySpecifierDefaultControlPolicy } from '../src/apply-specifier-default-control-policy';
import type { Contract } from '../src/contract-types';
import { effectiveControlPolicy } from '../src/control-policy';

describe('applySpecifierDefaultControlPolicy', () => {
  const minimalContract = {
    targetFamily: 'sql',
    target: 'postgres',
  } as Contract;

  it('keeps defaultControlPolicy when the contract already defines one', () => {
    const contract = { ...minimalContract, defaultControlPolicy: 'managed' as const };
    expect(applySpecifierDefaultControlPolicy(contract, 'external').defaultControlPolicy).toBe(
      'managed',
    );
  });

  it('writes the specifier default when the contract omits defaultControlPolicy', () => {
    expect(
      applySpecifierDefaultControlPolicy(minimalContract, 'external').defaultControlPolicy,
    ).toBe('external');
  });

  it('returns the contract unchanged when the specifier omits a default', () => {
    const contract = applySpecifierDefaultControlPolicy(minimalContract, undefined);
    expect(contract).toBe(minimalContract);
    expect(contract).not.toHaveProperty('defaultControlPolicy');
  });
});

describe('effectiveControlPolicy', () => {
  describe('precedence: node → default → managed', () => {
    it('returns the node value when both node and default are set', () => {
      expect(effectiveControlPolicy('tolerated', 'external')).toBe('tolerated');
    });

    it('returns the default value when node is undefined', () => {
      expect(effectiveControlPolicy(undefined, 'external')).toBe('external');
    });

    it('returns managed when both are undefined', () => {
      expect(effectiveControlPolicy(undefined, undefined)).toBe('managed');
    });
  });

  describe('each policy value resolves through', () => {
    it('resolves managed via node', () => {
      expect(effectiveControlPolicy('managed', undefined)).toBe('managed');
    });

    it('resolves tolerated via node', () => {
      expect(effectiveControlPolicy('tolerated', undefined)).toBe('tolerated');
    });

    it('resolves external via node', () => {
      expect(effectiveControlPolicy('external', undefined)).toBe('external');
    });

    it('resolves observed via node', () => {
      expect(effectiveControlPolicy('observed', undefined)).toBe('observed');
    });

    it('resolves managed via default', () => {
      expect(effectiveControlPolicy(undefined, 'managed')).toBe('managed');
    });

    it('resolves tolerated via default', () => {
      expect(effectiveControlPolicy(undefined, 'tolerated')).toBe('tolerated');
    });

    it('resolves external via default', () => {
      expect(effectiveControlPolicy(undefined, 'external')).toBe('external');
    });

    it('resolves observed via default', () => {
      expect(effectiveControlPolicy(undefined, 'observed')).toBe('observed');
    });
  });
});
