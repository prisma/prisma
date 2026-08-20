/**
 * A type constructor may declare a `bareSpellingWarning` advisory. PSL
 * lowering mints one AuthoringWarning per model field that resolves the
 * constructor via its bare type-name spelling; explicit constructor calls
 * and value-object storage resolution stay silent. Warnings surface through
 * the shared per-build flush (`process.emitWarning`).
 */
import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';
import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import { ifDefined } from '@internal/utils/defined';
import { describe, expect, it } from 'vitest';
import { useEmitWarningSpy } from '../../../1-core/contract/test/emit-warning-spy';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { interpretPslDocumentToSqlContract } from '../src/interpreter';
import {
  createBuiltinLikeControlMutationDefaults,
  postgresScalarAuthoringTypes,
  postgresTarget,
  symbolTableInputFromParseArgs,
} from './fixtures';

const LEGACY_WARNING = {
  code: 'PN_TEST_LEGACY_SPELLING',
  message: 'is typed "Legacy". Write "Modern" instead.',
  summary: 'fields are typed "Legacy". Write "Modern" instead.',
} as const;

const authoringTypes = {
  ...postgresScalarAuthoringTypes,
  Legacy: {
    kind: 'typeConstructor',
    output: { codecId: 'pg/json@1', nativeType: 'json' },
    bareSpellingWarning: LEGACY_WARNING,
  },
} satisfies AuthoringTypeNamespace;

const scalarColumnDescriptors = collectScalarTypeConstructors(authoringTypes);

describe('bare-spelling advisory at PSL lowering', () => {
  const builtinControlMutationDefaults = createBuiltinLikeControlMutationDefaults();
  const emitWarning = useEmitWarningSpy();

  function interpret(schema: string, valueObjectStorageType?: string) {
    const document = symbolTableInputFromParseArgs({ schema, sourceId: 'schema.prisma' });
    return interpretPslDocumentToSqlContract({
      ...document,
      target: postgresTarget,
      scalarColumnDescriptors,
      authoringContributions: {
        entityTypes: {},
        type: authoringTypes,
        field: {},
        ...ifDefined('valueObjectStorageType', valueObjectStorageType),
      },
      composedExtensionContracts: new Map(),
      controlMutationDefaults: builtinControlMutationDefaults,
      createNamespace: createTestSqlNamespace,
      capabilities: { sql: { scalarList: true } },
    });
  }

  function legacyWarningCalls() {
    return emitWarning().mock.calls.filter(
      ([, options]) => (options as { code?: string } | undefined)?.code === LEGACY_WARNING.code,
    );
  }

  it('a bare spelling warns once per field, naming the field', () => {
    const result = interpret(`model Doc {
  id Int @id
  meta Legacy
  extra Legacy?
}`);

    expect(result.ok).toBe(true);
    const messages = legacyWarningCalls().map((c) => String(c[0]));
    expect(messages).toEqual([
      'field "Doc.meta" is typed "Legacy". Write "Modern" instead.',
      'field "Doc.extra" is typed "Legacy". Write "Modern" instead.',
    ]);
  });

  it('a bare list spelling warns too', () => {
    const result = interpret(`model Doc {
  id Int @id
  metas Legacy[]
}`);

    expect(result.ok).toBe(true);
    const messages = legacyWarningCalls().map((c) => String(c[0]));
    expect(messages).toEqual(['field "Doc.metas" is typed "Legacy". Write "Modern" instead.']);
  });

  it('an explicit constructor call does not warn', () => {
    const result = interpret(`model Doc {
  id Int @id
  meta Legacy()
}`);

    expect(result.ok).toBe(true);
    expect(legacyWarningCalls()).toEqual([]);
  });

  it('value-object storage resolving through an advisory-carrying type does not warn', () => {
    const result = interpret(
      `type Address {
  street String
}

model User {
  id Int @id
  address Address
}`,
      'Legacy',
    );

    expect(result.ok).toBe(true);
    expect(legacyWarningCalls()).toEqual([]);
  });

  it('a named-type alias over an advisory type does not warn — the alias declaration is a deliberate single-site choice', () => {
    const result = interpret(`types {
  Meta = Legacy
}

model Doc {
  id Int @id
  meta Meta
}`);

    expect(result.ok).toBe(true);
    expect(legacyWarningCalls()).toEqual([]);
  });

  it('models outside the default namespace qualify the warning item with their namespace', () => {
    const result = interpret(`namespace audit {
  model Doc {
    id Int @id
    meta Legacy
  }
}

model Doc {
  id Int @id
  meta Legacy
}`);

    expect(result.ok).toBe(true);
    const messages = legacyWarningCalls().map((c) => String(c[0]));
    expect(messages.sort()).toEqual([
      'field "Doc.meta" is typed "Legacy". Write "Modern" instead.',
      'field "audit.Doc.meta" is typed "Legacy". Write "Modern" instead.',
    ]);
  });

  it('a type without the advisory never warns', () => {
    const result = interpret(`model Doc {
  id Int @id
  meta Jsonb
  data Json
}`);

    expect(result.ok).toBe(true);
    expect(legacyWarningCalls()).toEqual([]);
  });
});
