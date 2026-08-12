import { describe, expect, it } from 'vitest';
import type { PlanMeta } from '../src/types';

describe('PlanMeta', () => {
  it('carries identification and policy fields only', () => {
    const meta: PlanMeta = {
      target: 'postgres',
      targetFamily: 'sql',
      storageHash: 'test',
      profileHash: 'profile',
      lane: 'orm-client',
      annotations: { intent: 'read' },
    };
    expect(meta.target).toBe('postgres');
    expect(meta.lane).toBe('orm-client');
    expect(meta.annotations?.['intent']).toBe('read');
  });
});
