import { describe, expect, it } from 'vitest';
import { PostgresNativeEnum } from '../src/core/postgres-native-enum';
import { PostgresRole } from '../src/core/postgres-role';
import { PostgresSchema } from '../src/core/postgres-schema';

const aalLevelInput = {
  typeName: 'aal_level',
  members: ['aal1', 'aal2', 'aal3'],
  control: 'external' as const,
};

describe('PostgresNativeEnum', () => {
  it('constructs with typeName, ordered value-only members, and control', () => {
    const node = new PostgresNativeEnum(aalLevelInput);
    expect(node.kind).toBe('postgres-enum');
    expect(node.typeName).toBe('aal_level');
    expect(node.members).toEqual(['aal1', 'aal2', 'aal3']);
    expect(node.control).toBe('external');
  });

  it('omits control when not provided', () => {
    const node = new PostgresNativeEnum({
      typeName: 'aal_level',
      members: ['aal1'],
    });
    expect(Object.hasOwn(node, 'control')).toBe(false);
    expect('control' in JSON.parse(JSON.stringify(node))).toBe(false);
  });

  it('freezes the members array', () => {
    const node = new PostgresNativeEnum(aalLevelInput);
    expect(Object.isFrozen(node.members)).toBe(true);
  });

  it('is frozen — mutation throws in strict mode', () => {
    const node = new PostgresNativeEnum(aalLevelInput);
    expect(Object.isFrozen(node)).toBe(true);
    expect(() => {
      (node as { typeName: string }).typeName = 'mutated';
    }).toThrow();
  });

  it('kind is enumerable and survives JSON round-trip', () => {
    const node = new PostgresNativeEnum(aalLevelInput);
    const json = JSON.parse(JSON.stringify(node)) as Record<string, unknown>;
    expect(json['kind']).toBe('postgres-enum');
    expect(json['typeName']).toBe('aal_level');
    expect(json['members']).toEqual(aalLevelInput.members);
    expect(json['control']).toBe('external');
  });

  it('does not share the members array reference with input', () => {
    const members = ['aal1'];
    const node = new PostgresNativeEnum({ typeName: 'aal_level', members });
    expect(node.members).not.toBe(members);
  });

  describe('Contract-IR entity, not a DiffableNode', () => {
    it('has no id property', () => {
      const node = new PostgresNativeEnum(aalLevelInput);
      expect('id' in node).toBe(false);
    });

    it('has no children method', () => {
      const node = new PostgresNativeEnum(aalLevelInput);
      expect('children' in node).toBe(false);
    });

    it('has no isEqualTo method', () => {
      const node = new PostgresNativeEnum(aalLevelInput);
      expect('isEqualTo' in node).toBe(false);
    });
  });

  describe('PostgresNativeEnum.is guard', () => {
    it('returns true for a real PostgresNativeEnum', () => {
      expect(PostgresNativeEnum.is(new PostgresNativeEnum(aalLevelInput))).toBe(true);
    });

    it('returns false for a node with a different kind', () => {
      const role = new PostgresRole({ name: 'app_user', namespaceId: 'public' });
      expect(PostgresNativeEnum.is(role)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(PostgresNativeEnum.is(undefined)).toBe(false);
    });
  });
});

describe('PostgresSchema native_enum slot', () => {
  it('exposes an empty native_enum map when not provided', () => {
    const schema = new PostgresSchema({ id: 'public', entries: { table: {} } });
    expect(schema.entries.native_enum).toBeUndefined();
  });

  it('normalises plain native_enum input into PostgresNativeEnum instances', () => {
    const schema = new PostgresSchema({
      id: 'auth',
      entries: {
        table: {},
        native_enum: { AalLevel: aalLevelInput },
      },
    });
    const node = schema.entries.native_enum?.['aal_level'];
    expect(node).toBeInstanceOf(PostgresNativeEnum);
    expect(node?.typeName).toBe('aal_level');
    expect(node?.members).toHaveLength(3);
  });
});
