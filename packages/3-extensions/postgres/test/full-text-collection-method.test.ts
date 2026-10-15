import { describe, expect, it } from 'vitest';
import postgres from '../src/runtime/postgres';
import postgresServerless from '../src/runtime/postgres-serverless';
import type { Contract } from './fixtures/generated/contract';
import fixtureContractJson from './fixtures/generated/contract.json' with { type: 'json' };

describe('the Postgres clients', () => {
  it('both register the full-text collection method', () => {
    const client = postgres<Contract>({ contractJson: fixtureContractJson });
    const serverless = postgresServerless<Contract>({ contractJson: fixtureContractJson });

    expect({
      postgres: client.context.collectionMethods?.map(({ id }) => id),
      serverless: serverless.context.collectionMethods?.map(({ id }) => id),
    }).toEqual({ postgres: ['postgres/fullText'], serverless: ['postgres/fullText'] });
  });
});
