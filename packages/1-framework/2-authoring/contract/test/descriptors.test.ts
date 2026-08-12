import { describe, expect, it } from 'vitest';
import type { ForeignKeyDefaultsState, IndexDef } from '../src';

describe('descriptor exports', () => {
  it('keeps foreign key defaults as plain data', () => {
    const defaults: ForeignKeyDefaultsState = {
      constraint: true,
      index: false,
    };

    expect(defaults).toEqual({
      constraint: true,
      index: false,
    });
  });

  it('keeps index defs as plain data', () => {
    const index: IndexDef = {
      columns: ['email'],
      name: 'user_email_idx',
      type: 'btree',
      options: { fillfactor: 90 },
    };

    expect(index).toEqual({
      columns: ['email'],
      name: 'user_email_idx',
      type: 'btree',
      options: { fillfactor: 90 },
    });
  });
});
