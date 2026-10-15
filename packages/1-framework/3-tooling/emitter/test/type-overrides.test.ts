import type { ContractField, ContractModelBase } from '@internal/contract/types';
import type { CodecLookup } from '@internal/framework-components/codec';
import { describe, expect, it } from 'vitest';
import {
  generateFieldTypeOverridesMap,
  renderCodecTypeOverride,
  renderTypeOverride,
  renderTypeOverridesMap,
  renderValueSetOverride,
  resolveFieldTypeOverride,
} from '../src/domain-type-generation';

const literalLookup: CodecLookup = {
  get: () => undefined,
  renderOutputTypeFor: (id, params) =>
    id === 'demo/vector@1' ? `Vector<${params['length']}>` : undefined,
  renderInputTypeFor: (id, params) =>
    id === 'demo/vector@1' ? `VectorInput<${params['length']}>` : undefined,
  renderValueLiteralFor: (_id, value) => (typeof value === 'string' ? `"${value}"` : undefined),
};

describe('renderValueSetOverride', () => {
  it('gives both sides when every value has a literal type', () => {
    expect(renderValueSetOverride(['low', 'high'], 'demo/text@1', literalLookup)).toEqual({
      output: '"low" | "high"',
      input: '"low" | "high"',
    });
  });

  it('keeps the input side when only it has literal types', () => {
    const inputOnly: CodecLookup = {
      ...literalLookup,
      renderValueLiteralFor: (_id, value, side) =>
        side === 'input' && typeof value === 'string' ? `"${value}"` : undefined,
    };
    expect(renderValueSetOverride(['low'], 'demo/text@1', inputOnly)).toEqual({ input: '"low"' });
  });
});

describe('renderCodecTypeOverride', () => {
  it('gives the type text the codec renders on each side', () => {
    expect(renderCodecTypeOverride('demo/vector@1', { length: 3 }, literalLookup)).toEqual({
      output: 'Vector<3>',
      input: 'VectorInput<3>',
    });
  });

  it('gives nothing without type parameters, without a lookup, or for a codec that renders nothing', () => {
    expect([
      renderCodecTypeOverride('demo/vector@1', undefined, literalLookup),
      renderCodecTypeOverride('demo/vector@1', { length: 3 }, undefined),
      renderCodecTypeOverride('demo/text@1', { length: 3 }, literalLookup),
    ]).toEqual([undefined, undefined, undefined]);
  });

  it('leaves out text that is not a safe type expression', () => {
    const unsafe: CodecLookup = {
      get: () => undefined,
      renderOutputTypeFor: () => 'import("fs")',
      renderInputTypeFor: () => 'string',
    };
    expect(renderCodecTypeOverride('demo/x@1', { a: 1 }, unsafe)).toEqual({ input: 'string' });
  });
});

describe('resolveFieldTypeOverride', () => {
  const scalar = (typeParams?: Record<string, unknown>): ContractField => ({
    nullable: true,
    many: { elementNullable: false },
    type: {
      kind: 'scalar',
      codecId: 'demo/vector@1',
      ...(typeParams === undefined ? {} : { typeParams }),
    },
  });

  it('takes the value set before the codec, without the field modifiers', () => {
    expect(
      resolveFieldTypeOverride(scalar({ length: 3 }), literalLookup, {
        encodedValues: ['a', 'b'],
        codecId: 'demo/text@1',
      }),
    ).toEqual({ output: '"a" | "b"', input: '"a" | "b"' });
  });

  it('falls back to the codec text when the value set has no literal types', () => {
    expect(
      resolveFieldTypeOverride(scalar({ length: 3 }), literalLookup, {
        encodedValues: [1],
        codecId: 'demo/int@1',
      }),
    ).toEqual({ output: 'Vector<3>', input: 'VectorInput<3>' });
  });

  it('gives nothing for a scalar whose type parameters are empty or absent', () => {
    expect([
      resolveFieldTypeOverride(scalar({}), literalLookup, undefined),
      resolveFieldTypeOverride(scalar(), literalLookup, undefined),
    ]).toEqual([undefined, undefined]);
  });

  it('types a value object field by its aliases', () => {
    const field: ContractField = {
      nullable: true,
      many: false,
      type: { kind: 'valueObject', name: 'Address' },
    };
    expect(resolveFieldTypeOverride(field, literalLookup, undefined)).toEqual({
      output: 'AddressOutput',
      input: 'AddressInput',
    });
  });
});

describe('renderTypeOverride', () => {
  it('writes only the sides an override has', () => {
    expect([
      renderTypeOverride({ output: 'A' }),
      renderTypeOverride({ input: 'B' }),
      renderTypeOverride({ output: 'A', input: 'B' }),
    ]).toEqual([
      '{ readonly output: A }',
      '{ readonly input: B }',
      '{ readonly output: A; readonly input: B }',
    ]);
  });
});

describe('renderTypeOverridesMap', () => {
  it('orders every level by name and leaves out entries with no override', () => {
    expect(
      renderTypeOverridesMap([
        ['public', 'User', 'role', { output: 'R' }],
        ['auth', 'Session', 'id', undefined],
        ['public', 'Post', 'state', { input: 'S' }],
        ['public', 'User', 'kind', { output: 'K', input: 'K' }],
        ['auth', 'Account', 'tier', { output: 'T' }],
      ]),
    ).toBe(
      '{ readonly auth: { readonly Account: { readonly tier: { readonly output: T } } }; readonly public: { readonly Post: { readonly state: { readonly input: S } }; readonly User: { readonly kind: { readonly output: K; readonly input: K }; readonly role: { readonly output: R } } } }',
    );
  });

  it('is empty without overrides', () => {
    expect(renderTypeOverridesMap([['public', 'User', 'id', undefined]])).toBe('{  }');
  });
});

describe('generateFieldTypeOverridesMap', () => {
  it('collects the override of each field, from its value set or its codec', () => {
    const model = (fields: Record<string, ContractField>): ContractModelBase => ({
      fields,
      relations: {},
      storage: {},
    });
    const models = {
      User: model({
        id: { nullable: false, many: false, type: { kind: 'scalar', codecId: 'demo/int@1' } },
        mood: { nullable: false, many: false, type: { kind: 'scalar', codecId: 'demo/text@1' } },
        embedding: {
          nullable: false,
          many: false,
          type: { kind: 'scalar', codecId: 'demo/vector@1', typeParams: { length: 2 } },
        },
      }),
    };
    const resolveValueSet = (_model: string, field: string) =>
      field === 'mood' ? { encodedValues: ['up', 'down'], codecId: 'demo/text@1' } : undefined;

    expect(
      generateFieldTypeOverridesMap([['public', models]], literalLookup, resolveValueSet),
    ).toBe(
      '{ readonly public: { readonly User: { readonly embedding: { readonly output: Vector<2>; readonly input: VectorInput<2> }; readonly mood: { readonly output: "up" | "down"; readonly input: "up" | "down" } } } }',
    );
  });
});
