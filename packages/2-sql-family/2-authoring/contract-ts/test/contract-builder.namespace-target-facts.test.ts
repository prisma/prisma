import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { defineContract, field, model } from '../src/contract-builder';
import { columnDescriptor } from './helpers/column-descriptor';

const sqlFamilyPack: FamilyPackRef<'sql'> = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
};

const targetWithoutNamespaces: TargetPackRef<'sql', 'mysql'> = {
  kind: 'target',
  id: 'mysql',
  familyId: 'sql',
  targetId: 'mysql',
  version: '0.0.1',
  defaultNamespaceId: '__unbound__',
  supportsNamespaces: false,
  displayName: 'MySQL',
  namespacesUnsupportedReason: 'namespaces are not mapped to MySQL databases yet',
};

const targetWithLateBinding: TargetPackRef<'sql', 'cockroach'> = {
  kind: 'target',
  id: 'cockroach',
  familyId: 'sql',
  targetId: 'cockroach',
  version: '0.0.1',
  defaultNamespaceId: 'public',
  displayName: 'CockroachDB',
  unboundNamespaceName: 'late',
};

const userModelArgs = {
  fields: {
    id: field.column(columnDescriptor('pg/int4@1')).id(),
  },
} as const;

function build(target: TargetPackRef<'sql', string>, input: object) {
  return () =>
    defineContract({
      ...testTypeLookups,
      family: sqlFamilyPack,
      target,
      createNamespace: createTestSqlNamespace,
      ...input,
    });
}

describe('defineContract namespace rules read from the target descriptor', () => {
  it('refuses a namespaces list on a target that reports no namespaces', () => {
    expect(build(targetWithoutNamespaces, { namespaces: ['auth'] })).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.NAMESPACE_UNSUPPORTED',
        message:
          'defineContract: MySQL contracts cannot declare namespaces (namespaces are not mapped to MySQL databases yet; emitted DDL is always unqualified). Received namespaces: ["auth"].',
      }),
    );
  });

  it('refuses a per-model namespace on a target that reports no namespaces', () => {
    expect(
      build(targetWithoutNamespaces, {
        models: { User: model('User', { namespace: 'auth', ...userModelArgs }) },
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.NAMESPACE_UNSUPPORTED',
        message:
          'defineContract: model "User" sets `namespace: "auth"` but the target is MySQL (namespaces are not mapped to MySQL databases yet; remove the per-model `namespace` field).',
      }),
    );
  });

  it('reserves the unbound namespace name the target declares', () => {
    expect(build(targetWithLateBinding, { namespaces: ['late'] })).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.NAMESPACE_INVALID',
        meta: { namespace: 'late', reason: 'reserved-by-cockroach' },
      }),
    );
    expect(
      build(targetWithLateBinding, {
        namespaces: ['public'],
        models: { User: model('User', { namespace: 'late', ...userModelArgs }) },
      }),
    ).toThrow(
      /namespace: "late"` but that name is reserved by CockroachDB.*namespace late \{ … \}/,
    );
  });

  it('accepts `unbound` as an ordinary namespace on a target that reserves no name', () => {
    const { unboundNamespaceName: _reserved, ...target } = targetWithLateBinding;
    expect(build(target, { namespaces: ['unbound'] })).not.toThrow();
  });
});
