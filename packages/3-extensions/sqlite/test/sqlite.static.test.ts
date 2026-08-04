import type { Contract } from '@internal/contract/types';
import { coreHash, profileHash } from '@internal/contract/types';
import { SqlStorage } from '@internal/sql-contract/types';
import { sqliteCreateNamespace } from '@internal/target-sqlite/control';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import sqliteStatic, { type SqliteStaticContext } from '../src/static/sqlite-static';

const contract: Contract<SqlStorage> = {
  target: 'sqlite',
  targetFamily: 'sql',
  profileHash: profileHash('sqlite-static-test'),
  domain: applicationDomainOf({ models: {} }),
  roots: {},
  storage: new SqlStorage({
    storageHash: coreHash('sqlite-static-test'),
    namespaces: {
      __unbound__: sqliteCreateNamespace({ id: '__unbound__', entries: { table: {} } }),
    },
  }),
  extensions: {},
  capabilities: {},
  meta: {},
};

describe('sqliteStatic({ contractJson })', () => {
  it('returns context, contract, enums, sql, and raw', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(result.context).toBeDefined();
    expect(result.contract).toBeDefined();
    expect(result.enums).toBeDefined();
    expect(result.sql).toBeDefined();
    expect(result.raw).toBeDefined();
  });

  it('context carries the contract (merged capabilities view)', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(result.context.contract).toBeDefined();
    expect(result.context.contract.target).toBe(contract.target);
  });

  it('context carries the codec registry', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(result.context.contractCodecs).toBeDefined();
  });

  it('contract matches the deserialized contractJson', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(result.contract.target).toBe(contract.target);
    expect(result.contract.targetFamily).toBe(contract.targetFamily);
    expect(result.contract.domain).toEqual(contract.domain);
    expect(result.contract.profileHash).toBe(contract.profileHash);
  });

  it('sql is an object (unbound namespace builder)', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(typeof result.sql).toBe('object');
  });

  it('raw is a tagged template function', () => {
    const result = sqliteStatic<typeof contract>({ contractJson: contract });
    expect(typeof result.raw).toBe('function');
  });

  it('SqliteStaticContext type exposes context, contract, enums, sql, raw', () => {
    const result: SqliteStaticContext<typeof contract> = sqliteStatic<typeof contract>({
      contractJson: contract,
    });
    expect(result).toBeDefined();
  });
});
