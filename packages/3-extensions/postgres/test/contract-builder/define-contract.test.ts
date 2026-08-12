import { domainModelsAtDefaultNamespace } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { defineContract, field, model } from '../../src/exports/contract-builder';

const textColumn = {
  codecId: 'sql/char@1' as const,
  nativeType: 'character varying' as const,
  typeParams: {},
};

describe('postgres defineContract wrap', () => {
  it('pre-binds family and target (no factory form)', () => {
    const result = defineContract({});
    expect(result.target).toBe('postgres');
    expect(result.targetFamily).toBe('sql');
  });

  it('pre-binds family and target (factory form)', () => {
    const result = defineContract({}, ({ field: f, model: m }) => ({
      models: {
        Foo: m('Foo', { fields: { id: f.id.uuidv4String() } }),
      },
    }));
    expect(result.target).toBe('postgres');
    expect(result.targetFamily).toBe('sql');
    expect(domainModelsAtDefaultNamespace(result.domain)['Foo']).toBeDefined();
  });

  it('accepts extensions: undefined', () => {
    const result = defineContract({ extensions: undefined });
    expect(result.target).toBe('postgres');
  });

  it('produces a model when defined inline', () => {
    const result = defineContract({
      models: {
        Bar: model('Bar', { fields: { id: field.column(textColumn).id() } }),
      },
    });
    expect(domainModelsAtDefaultNamespace(result.domain)['Bar']).toBeDefined();
  });
});
