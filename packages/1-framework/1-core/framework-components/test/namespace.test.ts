import { describe, expect, it } from 'vitest';
import { NamespaceBase, UNBOUND_NAMESPACE_ID } from '../src/ir/namespace';

class TestNamespace extends NamespaceBase {
  override readonly kind = 'test-namespace';
  readonly entries: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {};

  constructor(readonly id: string) {
    super();
  }
}

describe('NamespaceBase.isUnbound', () => {
  it('the unbound-slot namespace answers true', () => {
    expect(new TestNamespace(UNBOUND_NAMESPACE_ID).isUnbound).toBe(true);
  });

  it('a bound namespace answers false', () => {
    expect(new TestNamespace('accounting').isUnbound).toBe(false);
  });
});
