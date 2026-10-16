import type { SqlStorage } from '@internal/sql-contract/types';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { createContract } from '@repo/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import postgres from '../src/exports/runtime';
import postgresServerless from '../src/exports/serverless';
import postgresStatic, { contractFromJson } from '../src/exports/static';
import type { Contract } from './fixtures/generated/contract.d';
import fixtureContractJson from './fixtures/generated/contract.json' with { type: 'json' };

function freshContractJson(): unknown {
  return structuredClone(fixtureContractJson);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('contractFromJson', () => {
  it('returns the contract the Postgres serializer hydrates', () => {
    const json = freshContractJson();

    expect(contractFromJson<Contract>(json)).toEqual(
      new PostgresContractSerializer().deserializeContract(json),
    );
  });

  it('throws the structured validation error for invalid JSON', () => {
    expect(() => contractFromJson({ target: 'postgres' })).toThrow(
      expect.objectContaining({
        name: 'ContractValidationError',
        code: 'CONTRACT.VALIDATION_FAILED',
      }),
    );
  });
});

describe('validating a contract once', () => {
  it('validates a contractFromJson value once for every client built from it', () => {
    const deserialize = vi.spyOn(PostgresContractSerializer.prototype, 'deserializeContract');
    const contract = contractFromJson<Contract>(freshContractJson());

    const clients = [
      postgres({ contract }),
      postgres({ contract }),
      postgresServerless({ contract }),
    ];
    postgresStatic({ contract });

    expect(deserialize).toHaveBeenCalledTimes(1);
    for (const client of clients) {
      expect(client.contract).toBe(contract);
    }
  });

  it('validates a TypeScript-authored contract once, and the contract a client holds not again', () => {
    const deserialize = vi.spyOn(PostgresContractSerializer.prototype, 'deserializeContract');
    const authored = createContract<SqlStorage>();

    const first = postgres({ contract: authored });
    const second = postgres({ contract: authored });
    postgresStatic({ contract: first.contract });

    expect(deserialize).toHaveBeenCalledTimes(1);
    expect(second.contract).toBe(first.contract);
  });
});
