import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { PostgresPolicySchemaNode } from '../src/core/schema-ir/postgres-policy-schema-node';
import { PostgresRoleSchemaNode } from '../src/core/schema-ir/postgres-role-schema-node';

const basePolicyInput = {
  name: 'read_own_profiles_a1b2c3d4',
  prefix: 'read_own_profiles',
  tableName: 'profiles',
  namespaceId: 'public',
  operation: 'select' as const,
  roles: ['app_user'],
  using: "owner_id = current_setting('app.uid')::int",
  permissive: true,
};

describe('PostgresPolicySchemaNode', () => {
  it('id returns the wire name', () => {
    const node = new PostgresPolicySchemaNode(basePolicyInput);
    expect(node.id).toBe('read_own_profiles_a1b2c3d4');
  });

  it('children() returns empty array (leaf)', () => {
    const node = new PostgresPolicySchemaNode(basePolicyInput);
    expect(node.children()).toEqual([]);
  });

  it('isEqualTo returns true for same wire name', () => {
    const a = new PostgresPolicySchemaNode(basePolicyInput);
    const b = new PostgresPolicySchemaNode({ ...basePolicyInput });
    expect(a.isEqualTo(b)).toBe(true);
  });

  it('isEqualTo returns false for different wire name', () => {
    const a = new PostgresPolicySchemaNode(basePolicyInput);
    const b = new PostgresPolicySchemaNode({
      ...basePolicyInput,
      name: 'read_own_profiles_deadbeef',
    });
    expect(a.isEqualTo(b)).toBe(false);
  });

  it('isEqualTo throws when other is not a PostgresPolicySchemaNode', () => {
    const a = new PostgresPolicySchemaNode(basePolicyInput);
    const b = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: UNBOUND_NAMESPACE_ID });
    expect(() => a.isEqualTo(b)).toThrow();
  });

  it('carries all fields from input', () => {
    const node = new PostgresPolicySchemaNode(basePolicyInput);
    expect(node.name).toBe(basePolicyInput.name);
    expect(node.prefix).toBe(basePolicyInput.prefix);
    expect(node.tableName).toBe(basePolicyInput.tableName);
    expect(node.namespaceId).toBe(basePolicyInput.namespaceId);
    expect(node.operation).toBe(basePolicyInput.operation);
    expect(node.roles).toEqual(basePolicyInput.roles);
    expect(node.using).toBe(basePolicyInput.using);
    expect(node.permissive).toBe(basePolicyInput.permissive);
  });

  it('withCheck is absent when not provided', () => {
    const node = new PostgresPolicySchemaNode(basePolicyInput);
    expect(Object.hasOwn(node, 'withCheck')).toBe(false);
  });

  it('using is absent when not provided', () => {
    const { using: _dropped, ...rest } = basePolicyInput;
    const node = new PostgresPolicySchemaNode({
      ...rest,
      withCheck: 'true',
    });
    expect(Object.hasOwn(node, 'using')).toBe(false);
  });

  it('instance is frozen', () => {
    const node = new PostgresPolicySchemaNode(basePolicyInput);
    expect(Object.isFrozen(node)).toBe(true);
  });

  describe('prefix invariant (managed vs exact)', () => {
    it('an exact node carries no prefix — the property is absent', () => {
      const { prefix: _dropped, ...rest } = basePolicyInput;
      const exact = new PostgresPolicySchemaNode({ ...rest, name: 'Tenant members can read' });
      expect(exact.prefix).toBeUndefined();
      expect(Object.hasOwn(exact, 'prefix')).toBe(false);
    });

    it('a declared prefix must match the wire name', () => {
      expect(() => new PostgresPolicySchemaNode({ ...basePolicyInput, prefix: 'other' })).toThrow(
        /prefix "other" does not match the wire name/,
      );
      expect(
        () =>
          new PostgresPolicySchemaNode({
            ...basePolicyInput,
            name: 'not_wire_shaped',
            prefix: 'not_wire_shaped',
          }),
      ).toThrow(/does not match the wire name/);
    });
  });

  describe('isEqualTo — exact mode (prefix absent) compares content', () => {
    const { prefix: _dropped, ...managedless } = basePolicyInput;
    const exactInput = { ...managedless, name: 'Tenant members can read' };

    it('equal when every compared field matches', () => {
      const a = new PostgresPolicySchemaNode(exactInput);
      const b = new PostgresPolicySchemaNode({ ...exactInput });
      expect(a.isEqualTo(b)).toBe(true);
    });

    it('operation drift breaks equality', () => {
      const a = new PostgresPolicySchemaNode(exactInput);
      const b = new PostgresPolicySchemaNode({ ...exactInput, operation: 'update' });
      expect(a.isEqualTo(b)).toBe(false);
    });

    it('permissive drift breaks equality', () => {
      const a = new PostgresPolicySchemaNode(exactInput);
      const b = new PostgresPolicySchemaNode({ ...exactInput, permissive: false });
      expect(a.isEqualTo(b)).toBe(false);
    });

    it('roles compare sorted — order does not matter, membership does', () => {
      const a = new PostgresPolicySchemaNode({ ...exactInput, roles: ['b_role', 'a_role'] });
      const sameSet = new PostgresPolicySchemaNode({ ...exactInput, roles: ['a_role', 'b_role'] });
      const differentSet = new PostgresPolicySchemaNode({ ...exactInput, roles: ['a_role'] });
      expect(a.isEqualTo(sameSet)).toBe(true);
      expect(a.isEqualTo(differentSet)).toBe(false);
    });

    it('using compares verbatim byte-for-byte — whitespace variants are unequal', () => {
      const a = new PostgresPolicySchemaNode({ ...exactInput, using: '(user_id = 1)' });
      const drifted = new PostgresPolicySchemaNode({ ...exactInput, using: '(user_id = 2)' });
      const whitespace = new PostgresPolicySchemaNode({ ...exactInput, using: '( user_id = 1 )' });
      expect(a.isEqualTo(drifted)).toBe(false);
      expect(a.isEqualTo(whitespace)).toBe(false);
    });

    it('withCheck compares verbatim; absent equals empty', () => {
      const a = new PostgresPolicySchemaNode({ ...exactInput, withCheck: 'true' });
      const b = new PostgresPolicySchemaNode({ ...exactInput, withCheck: 'false' });
      expect(a.isEqualTo(b)).toBe(false);

      const absent = new PostgresPolicySchemaNode(exactInput);
      const empty = new PostgresPolicySchemaNode({ ...exactInput, withCheck: '' });
      expect(absent.isEqualTo(empty)).toBe(true);
    });
  });

  describe('isEqualTo — managed mode stays id-driven', () => {
    it('same wire name is equal even when bodies differ (hash identity covers content)', () => {
      const a = new PostgresPolicySchemaNode(basePolicyInput);
      const b = new PostgresPolicySchemaNode({
        ...basePolicyInput,
        using: 'a completely different predicate',
        operation: 'select',
      });
      expect(a.isEqualTo(b)).toBe(true);
    });
  });

  describe('PostgresPolicySchemaNode.is', () => {
    it('returns true for a PostgresPolicySchemaNode', () => {
      const node = new PostgresPolicySchemaNode(basePolicyInput);
      expect(PostgresPolicySchemaNode.is(node)).toBe(true);
    });

    it('returns false for a PostgresRoleSchemaNode', () => {
      const role = new PostgresRoleSchemaNode({
        name: 'app_user',
        namespaceId: UNBOUND_NAMESPACE_ID,
      });
      expect(PostgresPolicySchemaNode.is(role)).toBe(false);
    });
  });

  describe('dependsOn', () => {
    const dependsOn = [
      [
        { nodeKind: 'postgres-database', id: 'database' },
        { nodeKind: 'postgres-namespace', id: 'public' },
        { nodeKind: 'postgres-table', id: 'profiles' },
      ],
      [
        { nodeKind: 'postgres-database', id: 'database' },
        { nodeKind: 'postgres-role', id: 'app_user' },
      ],
    ];

    it('is readable when supplied', () => {
      const node = new PostgresPolicySchemaNode({ ...basePolicyInput, dependsOn });
      expect(node.dependsOn).toEqual(dependsOn);
    });

    it('is absent when not supplied', () => {
      const node = new PostgresPolicySchemaNode(basePolicyInput);
      expect(node.dependsOn).toBeUndefined();
    });

    it('is non-enumerable — excluded from JSON and structural equality', () => {
      const node = new PostgresPolicySchemaNode({ ...basePolicyInput, dependsOn });
      expect(Object.keys(node)).not.toContain('dependsOn');
      expect(JSON.parse(JSON.stringify(node))).not.toHaveProperty('dependsOn');
    });

    it('is ignored by isEqualTo', () => {
      const a = new PostgresPolicySchemaNode({ ...basePolicyInput, dependsOn });
      const b = new PostgresPolicySchemaNode(basePolicyInput);
      expect(a.isEqualTo(b)).toBe(true);
    });
  });
});

describe('PostgresRoleSchemaNode', () => {
  it('id returns the bare role name', () => {
    const node = new PostgresRoleSchemaNode({
      name: 'app_user',
      namespaceId: UNBOUND_NAMESPACE_ID,
    });
    // The differ pairs siblings by (nodeKind, id), so a role never collides
    // with a same-named schema even though both use the bare name as id.
    expect(node.id).toBe('app_user');
    expect(node.name).toBe('app_user');
  });

  it('children() returns empty array (leaf)', () => {
    const node = new PostgresRoleSchemaNode({
      name: 'app_user',
      namespaceId: UNBOUND_NAMESPACE_ID,
    });
    expect(node.children()).toEqual([]);
  });

  it('isEqualTo returns true for same name', () => {
    const a = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: UNBOUND_NAMESPACE_ID });
    const b = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: UNBOUND_NAMESPACE_ID });
    expect(a.isEqualTo(b)).toBe(true);
  });

  it('isEqualTo returns false for different name', () => {
    const a = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: UNBOUND_NAMESPACE_ID });
    const b = new PostgresRoleSchemaNode({ name: 'anon', namespaceId: UNBOUND_NAMESPACE_ID });
    expect(a.isEqualTo(b)).toBe(false);
  });

  it('isEqualTo throws when other is not a PostgresRoleSchemaNode', () => {
    const a = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: UNBOUND_NAMESPACE_ID });
    const b = new PostgresPolicySchemaNode(basePolicyInput);
    expect(() => a.isEqualTo(b)).toThrow();
  });

  it('carries all fields from input', () => {
    const node = new PostgresRoleSchemaNode({ name: 'app_user', namespaceId: 'public' });
    expect(node.name).toBe('app_user');
    expect(node.namespaceId).toBe('public');
  });

  it('instance is frozen', () => {
    const node = new PostgresRoleSchemaNode({
      name: 'app_user',
      namespaceId: UNBOUND_NAMESPACE_ID,
    });
    expect(Object.isFrozen(node)).toBe(true);
  });

  describe('PostgresRoleSchemaNode.is', () => {
    it('returns true for a PostgresRoleSchemaNode', () => {
      const node = new PostgresRoleSchemaNode({
        name: 'app_user',
        namespaceId: UNBOUND_NAMESPACE_ID,
      });
      expect(PostgresRoleSchemaNode.is(node)).toBe(true);
    });

    it('returns false for a PostgresPolicySchemaNode', () => {
      const policy = new PostgresPolicySchemaNode(basePolicyInput);
      expect(PostgresRoleSchemaNode.is(policy)).toBe(false);
    });
  });
});
