import { MongoContractSerializer } from '@internal/family-mongo/ir';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Contract } from '../../../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract';
import fixtureContractJson from '../../../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract.json' with {
  type: 'json',
};
import { mongoQuery, PipelineChain } from '../src/exports/query-builder';
import mongo from '../src/exports/runtime';
import { contractFromJson } from '../src/exports/static';

afterEach(() => {
  vi.restoreAllMocks();
});

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('nothing was thrown');
}

describe('mongoQuery({ contract })', () => {
  it('rejects a malformed contract with the error mongo({ contract }) throws', () => {
    const malformed = { target: 'mongo' } as unknown as Contract;

    const fromQuery = thrownBy(() => mongoQuery({ contract: malformed }));
    const fromClient = thrownBy(() => mongo({ contract: malformed }));

    expect(fromQuery).toMatchObject({ code: 'CONTRACT.VALIDATION_FAILED' });
    expect({
      code: (fromQuery as { code: unknown }).code,
      message: (fromQuery as Error).message,
    }).toEqual({
      code: (fromClient as { code: unknown }).code,
      message: (fromClient as Error).message,
    });
  });

  it('does not validate a contractFromJson value again', () => {
    const contract = contractFromJson<Contract>(structuredClone(fixtureContractJson));
    const deserialize = vi.spyOn(MongoContractSerializer.prototype, 'deserializeContract');

    mongoQuery({ contract });

    expect(deserialize).not.toHaveBeenCalled();
  });

  it('still offers the rest of the query builder', () => {
    expect(PipelineChain).toBeTypeOf('function');
  });
});
