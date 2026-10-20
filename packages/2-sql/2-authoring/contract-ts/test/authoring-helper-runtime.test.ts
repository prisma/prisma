import type {
  AuthoringFieldNamespace,
  AuthoringTypeNamespace,
} from '@internal/framework-components/authoring';
import { createDataTypeLookup } from '@internal/framework-components/codec';
import type {
  ExtensionPackRef,
  FamilyPackRef,
  TargetPackRef,
} from '@internal/framework-components/components';
import { sqlDataType } from '@internal/sql-contract/data-type';
import {
  sql,
  sqlExpressionAuthoringEntry,
  sqlExpressionRegistration,
} from '@internal/sql-contract/sql-expression';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import {
  testSqlTypeLookups,
  testTypeLookups,
} from '../../../1-core/contract/test/test-type-lookups';
import { fixtureDataTypeSupport } from '../../contract-psl/test/fixture-data-types';
import {
  createFieldPresetHelper,
  createTypeHelpersFromNamespace,
  isNamedConstraintOptionsLike,
} from '../src/authoring-helper-runtime';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { nanoidIdPresetMirror } from './nanoid-preset-mirror';

const helperLookups = {
  codecLookup: testTypeLookups.codecLookup,
  dataTypes: fixtureDataTypeSupport,
};

const textPreset = {
  kind: 'fieldPreset',
  output: { codecId: 'sql/text@1' },
} as const;

const bareFamilyPack = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
} as const satisfies FamilyPackRef<'sql'>;

const bareTargetPack = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
} as const satisfies TargetPackRef<'sql', 'postgres'>;

const nestedTypeNamespace = {
  pgvector: {
    Vector: {
      kind: 'typeConstructor',
      args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
      output: {
        codecId: 'pg/vector@1',
        typeParams: {
          length: { kind: 'arg', index: 0 },
        },
      },
    },
  },
} as const satisfies AuthoringTypeNamespace;

const uniqueTextFieldNamespace = {
  slug: {
    ...textPreset,
    output: {
      ...textPreset.output,
      unique: true,
    },
  },
} as const satisfies AuthoringFieldNamespace;

function withBlockedKey<T extends object>(value: T): T {
  const unsafe = Object.create(null) as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    unsafe[key] = entry;
  }
  Object.defineProperty(unsafe, '__proto__', {
    enumerable: true,
    value: value,
  });
  return unsafe as T;
}

describe('authoring helper runtime', () => {
  it('recognizes valid named constraint option objects', () => {
    expect(isNamedConstraintOptionsLike({})).toBe(true);
    expect(isNamedConstraintOptionsLike({ name: 'user_pkey' })).toBe(true);
  });

  it('rejects invalid named constraint option shapes', () => {
    expect(isNamedConstraintOptionsLike(null)).toBe(false);
    expect(isNamedConstraintOptionsLike([])).toBe(false);
    expect(isNamedConstraintOptionsLike({ name: 123 })).toBe(false);
    expect(isNamedConstraintOptionsLike({ name: 'user_pkey', extra: true })).toBe(false);
  });

  it('creates nested type helpers and instantiates storage types', () => {
    const helpers = createTypeHelpersFromNamespace(nestedTypeNamespace, helperLookups) as {
      readonly pgvector: {
        readonly Vector: (length: number) => {
          readonly codecId: string;
          readonly typeParams: { readonly length: number };
        };
      };
    };

    expect(helpers.pgvector.Vector(1536)).toEqual({
      kind: 'codec-instance',
      codecId: 'pg/vector@1',
      typeParams: { length: 1536 },
    });
  });

  it('rejects blocked path segments when building type helpers', () => {
    const unsafeNamespace = {
      nested: withBlockedKey({
        Vector: nestedTypeNamespace.pgvector.Vector,
      }),
    } as unknown as AuthoringTypeNamespace;

    expect(() => createTypeHelpersFromNamespace(unsafeNamespace, helperLookups)).toThrow(
      'Invalid authoring helper "nested.__proto__". Helper path segments must not use "__proto__".',
    );
    expect(() => createTypeHelpersFromNamespace(unsafeNamespace, helperLookups)).toThrow(
      expect.objectContaining({ code: 'CONTRACT.PACK_CONTRIBUTION_INVALID' }),
    );
  });

  it('passes optional named constraint options through field preset helpers', () => {
    const helper = createFieldPresetHelper({
      helperPath: 'field.id.nanoid',
      descriptor: nanoidIdPresetMirror,
      codecLookup: testTypeLookups.codecLookup,
      dataTypes: fixtureDataTypeSupport,
      build: ({ args, namedConstraintOptions }) => ({
        args,
        namedConstraintOptions,
      }),
    });

    expect(helper({ size: 16 }, { name: 'short_link_pkey' })).toEqual({
      args: [{ size: 16 }],
      namedConstraintOptions: { name: 'short_link_pkey' },
    });
  });

  it('rejects extra arguments for helpers that accept named constraint options', () => {
    const helper = createFieldPresetHelper({
      helperPath: 'field.id.nanoid',
      descriptor: nanoidIdPresetMirror,
      codecLookup: testTypeLookups.codecLookup,
      dataTypes: fixtureDataTypeSupport,
      build: ({ args, namedConstraintOptions }) => ({
        args,
        namedConstraintOptions,
      }),
    });

    expect(() => helper({ size: 16 }, { name: 'short_link_pkey' }, { name: 'ignored' })).toThrow(
      'field.id.nanoid expects at most 2 argument(s), received 3',
    );
    expect(() => helper({ size: 16 }, { name: 'short_link_pkey' }, { name: 'ignored' })).toThrow(
      expect.objectContaining({ code: 'CONTRACT.ARGUMENT_INVALID' }),
    );
  });

  it('rejects malformed named constraint option objects', () => {
    const helper = createFieldPresetHelper({
      helperPath: 'field.id.nanoid',
      descriptor: nanoidIdPresetMirror,
      codecLookup: testTypeLookups.codecLookup,
      dataTypes: fixtureDataTypeSupport,
      build: ({ args, namedConstraintOptions }) => ({
        args,
        namedConstraintOptions,
      }),
    });

    expect(() => helper({ size: 16 }, { invalid: true } as never)).toThrow(
      'field.id.nanoid accepts an optional trailing { name?: string } constraint options object',
    );
  });
});

describe('createComposedAuthoringHelpers', () => {
  it('builds custom unique field helpers and keeps core helpers available', () => {
    const slugPack = {
      kind: 'extension',
      id: 'slug-pack',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      authoring: {
        field: uniqueTextFieldNamespace,
      },
    } as const satisfies ExtensionPackRef<'sql', 'postgres'>;

    const helpers = createComposedAuthoringHelpers({
      ...testTypeLookups,
      family: bareFamilyPack,
      target: bareTargetPack,
      extensions: {
        slugPack,
      },
    });

    const slugState = helpers.field.slug({ name: 'post_slug_key' }).build();
    expect(slugState.unique).toEqual({ name: 'post_slug_key' });
    expect(helpers.field.column).toBeDefined();
    expect(helpers.type).toEqual({});
  });

  it('rejects duplicate nested type helper paths across composed packs', () => {
    const targetPack = {
      ...bareTargetPack,
      authoring: {
        type: nestedTypeNamespace,
      },
    } as const satisfies TargetPackRef<'sql', 'postgres'>;

    const conflictingPack = {
      kind: 'extension',
      id: 'conflicting-pack',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      authoring: {
        type: nestedTypeNamespace,
      },
    } as const satisfies ExtensionPackRef<'sql', 'postgres'>;

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: bareFamilyPack,
        target: targetPack,
        extensions: {
          conflictingPack,
        },
      }),
    ).toThrow(
      'Duplicate authoring type helper "pgvector.Vector". Helper names must be unique across composed packs.',
    );
  });

  it('refuses a value argument whose data type no composed pack registers, as the control stack does', () => {
    const targetPack = {
      ...bareTargetPack,
      authoring: { type: nestedTypeNamespace },
    } as const satisfies TargetPackRef<'sql', 'postgres'>;

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: bareFamilyPack,
        target: targetPack,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DATA_TYPE_UNREGISTERED',
        message:
          'Argument "length" of type constructor "pgvector.Vector" names data type "pg/int4", which no component registers. Contributed by "postgres".',
      }),
    );
  });

  it('refuses two packs registering an authoring entry for one data type', () => {
    const { dataTypes } = sqlExpressionRegistration.authoring;
    const familyPack = { ...bareFamilyPack, authoring: { dataTypes } };
    const targetPack = { ...bareTargetPack, authoring: { dataTypes } };

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: familyPack,
        target: targetPack,
      }),
    ).toThrow(expect.objectContaining({ code: 'CONTRACT.DATA_TYPE_ENTRY_DUPLICATE' }));
  });

  it('refuses two packs whose entries claim one written form, as the control stack does', () => {
    const otherSql = sqlDataType('x/sql', { read: (json) => json });
    const familyPack = { ...bareFamilyPack, ...sqlExpressionRegistration };
    const targetPack = {
      ...bareTargetPack,
      dataTypes: [otherSql],
      authoring: {
        dataTypes: {
          [otherSql.id]: sqlExpressionRegistration.authoring.dataTypes['sql/expression'],
        },
      },
    };

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: familyPack,
        target: targetPack,
      }),
    ).toThrow(expect.objectContaining({ code: 'CONTRACT.DATA_TYPE_WRITTEN_FORM_DUPLICATE' }));
  });

  it('rejects extension helpers that collide with reserved core field helper names', () => {
    const reservedFieldPack = {
      kind: 'extension',
      id: 'reserved-field-pack',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      authoring: {
        field: {
          column: textPreset,
        },
      },
    } as const satisfies ExtensionPackRef<'sql', 'postgres'>;

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: bareFamilyPack,
        target: bareTargetPack,
        extensions: {
          reservedFieldPack,
        },
      }),
    ).toThrow('Duplicate authoring field helper "column". Core field helpers reserve that name.');
  });

  it('rejects ambiguous paths registered as both a field preset and a type constructor', () => {
    // Same path (`shared.thing`) is registered as a field preset on the
    // target and as a type constructor on an extension pack — this would
    // make PSL resolution ambiguous (field-preset wins per RD9, but the
    // double-registration is still a registry-coherence bug). The
    // composition layer rejects it with a clear error.
    const targetWithFieldPreset = {
      ...bareTargetPack,
      authoring: {
        field: {
          shared: {
            thing: textPreset,
          },
        },
      },
    } as const satisfies TargetPackRef<'sql', 'postgres'>;

    const extensionWithTypeConstructor = {
      kind: 'extension',
      id: 'colliding-pack',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      authoring: {
        type: {
          shared: {
            thing: {
              kind: 'typeConstructor',
              output: { codecId: 'sql/text@1' },
            },
          },
        },
      },
    } as const satisfies ExtensionPackRef<'sql', 'postgres'>;

    expect(() =>
      createComposedAuthoringHelpers({
        ...testTypeLookups,
        family: bareFamilyPack,
        target: targetWithFieldPreset,
        extensions: {
          extensionWithTypeConstructor,
        },
      }),
    ).toThrow('Ambiguous authoring registry path "shared.thing"');
  });

  describe('type helpers read the codec’s data type', () => {
    const varchar = sqlDataType('t/varchar', {
      read: (json) => json,
      params: type({ 'length?': 'number.integer >= 1 & number.integer <= 10485760' }),
      texts: [
        { text: 'character varying', written: true },
        { text: 'character varying({length})', written: true },
      ],
    });
    const lookups = {
      ...testSqlTypeLookups(),
      dataTypeLookup: createDataTypeLookup([varchar]),
      codecLookup: {
        ...testTypeLookups.codecLookup,
        descriptorFor: (codecId: string) => ({
          ...testTypeLookups.codecLookup.descriptorFor(codecId),
          codecId,
          dataType: varchar.id,
          traits: [],
          paramsSchema: varchar.params,
          isParameterized: true,
          factory: () => () => {
            throw new Error('not used');
          },
        }),
      },
    };
    const namespace = {
      VarChar: {
        kind: 'typeConstructor',
        args: [{ kind: 'value', dataType: 'pg/int4', name: 'length', optional: true }],
        output: { codecId: 't/varchar@1', typeParams: { length: { kind: 'arg', index: 0 } } },
      },
    } as const satisfies AuthoringTypeNamespace;
    const helpers = createTypeHelpersFromNamespace(namespace, {
      codecLookup: lookups.codecLookup,
      dataTypes: fixtureDataTypeSupport,
    }) as {
      readonly VarChar: (length?: number) => unknown;
    };

    it('names the storage type from the codec’s data type', () => {
      expect(helpers.VarChar(255)).toEqual({
        kind: 'codec-instance',
        codecId: 't/varchar@1',
        typeParams: { length: 255 },
      });
    });

    it('accepts an argument at the edges of the data type’s bounds', () => {
      expect(() => helpers.VarChar(1)).not.toThrow();
      expect(() => helpers.VarChar(10485760)).not.toThrow();
    });

    it.each([0, 10485761])('refuses %s, outside the data type’s bounds', (length) => {
      expect(() => helpers.VarChar(length)).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.ARGUMENT_INVALID',
          message: expect.stringMatching(
            /^Authoring helper argument at VarChar\[0\] is invalid: length must be/,
          ),
        }),
      );
    });
  });

  describe('value arguments', () => {
    const namespace = {
      Sized: {
        kind: 'typeConstructor',
        args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
        output: { codecId: 'pg/vector@1', typeParams: { length: { kind: 'arg', index: 0 } } },
      },
      Raw: {
        kind: 'typeConstructor',
        args: [{ kind: 'value', dataType: 'sql/expression', name: 'sql' }],
        output: { codecId: 'sql/raw@1', typeParams: { sql: { kind: 'arg', index: 0 } } },
      },
    } as const satisfies AuthoringTypeNamespace;
    const helpers = createTypeHelpersFromNamespace(namespace, helperLookups) as {
      readonly Sized: (length: unknown) => unknown;
      readonly Raw: (definition: unknown) => unknown;
    };
    const refusal = (message: string) =>
      expect.objectContaining({ code: 'CONTRACT.ARGUMENT_INVALID', message });

    it('gives a sql value as the canonical text of its literal', () => {
      expect(helpers.Raw(sql`"MyType"[]`)).toEqual({
        kind: 'codec-instance',
        codecId: 'sql/raw@1',
        typeParams: { sql: '"MyType"[]' },
      });
    });

    it('refuses a number its data type cannot hold, as PSL does', () => {
      expect(() => helpers.Sized(3000000000)).toThrow(
        refusal('Argument "length" of Sized: Expected a number that pg/int4 can hold; got pg/int8'),
      );
    });

    it('refuses a string where a number goes', () => {
      expect(() => helpers.Sized('255')).toThrow(
        refusal('Argument "length" of Sized: Expected a number; write 255'),
      );
    });

    it('refuses a value that is not written in any form, such as an object', () => {
      expect(() => helpers.Raw({ text: 'circle' })).toThrow(
        refusal('Argument "sql" of Raw: Expected sql`...`'),
      );
    });

    it('refuses a string where a sql value goes, with the value to write', () => {
      expect(() => helpers.Raw('circle')).toThrow(
        refusal('Argument "sql" of Raw: Expected sql`...`; write sql`circle`'),
      );
    });
  });
});
