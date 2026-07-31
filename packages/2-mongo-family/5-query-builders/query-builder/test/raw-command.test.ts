import { InsertOneCommand, RawAggregateCommand } from '@internal/mongo-query-ast/execution';
import { describe, expect, it } from 'vitest';
import { mongoQuery } from '../src/query';
import type { TContract } from './fixtures/test-contract';
import { testContractJson } from './fixtures/test-contract';

const root = () => mongoQuery<TContract>({ contractJson: testContractJson });

describe('M5 raw escape hatch', () => {
  it('packages a typed CRUD command into a plan with lane: mongo-query', () => {
    const cmd = new InsertOneCommand('orders', { status: 'new' });
    const plan = root().rawCommand(cmd);
    expect(plan.command).toBe(cmd);
    expect(plan.collection).toBe('orders');
    expect(plan.meta.lane).toBe('mongo-query');
    expect(plan.meta.storageHash).toBe(testContractJson.storage.storageHash);
  });

  it('packages a RawMongoCommand (raw aggregate) without translating it', () => {
    const cmd = new RawAggregateCommand('orders', [{ $match: { status: 'new' } }]);
    const plan = root().rawCommand(cmd);
    expect(plan.command).toBe(cmd);
    expect(plan.meta.lane).toBe('mongo-query');
  });

  it('throws when the contract is missing a storageHash (signals an unvalidated contract)', () => {
    const cmd = new InsertOneCommand('orders', { status: 'new' });
    expect(() =>
      mongoQuery<TContract>({ contractJson: { ...testContractJson, storage: {} } }).rawCommand(cmd),
    ).toThrow(/storageHash/);
  });
});
