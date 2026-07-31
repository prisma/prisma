import { MongoFieldFilter, MongoProjectStage } from '@internal/mongo-query-ast/execution';
import { blindCast } from '@internal/utils/casts';
import { describe, expect, it } from 'vitest';
import { mongoQuery } from '../src/query';
import {
  contractFieldToMongoFieldShape,
  contractModelToMongoResultShape,
} from '../src/result-shape';
import type { TContract } from './fixtures/test-contract';
import { testContractJson } from './fixtures/test-contract';

describe('contractModelToMongoResultShape', () => {
  // Hand-authored fixture JSON; cast at the test-fixture seam (allowed by
  // `.cursor/rules/as-contract-cast-smell.mdc`). Production code crosses
  // the family `deserializeContract` seam instead.
  const contract = blindCast<
    TContract,
    'query-builder fixture JSON carries domain.namespaces envelope'
  >(testContractJson);

  it('maps full Order model scalars to leaf shapes', () => {
    const model = contract.domain.namespaces.__unbound__!.models['Order'];
    const shape = contractModelToMongoResultShape(model);
    expect(shape.kind).toBe('document');
    if (shape.kind !== 'document') return;
    expect(shape.fields['status']).toEqual({
      kind: 'leaf',
      codecId: 'mongo/string@1',
      nullable: false,
    });
    expect(shape.fields['tags']).toEqual({
      kind: 'array',
      nullable: false,
      element: { kind: 'leaf', codecId: 'mongo/string@1', nullable: false },
    });
  });

  it('maps value-object field to unknown', () => {
    const model = contract.domain.namespaces.__unbound__!.models['Customer'];
    const shape = contractModelToMongoResultShape(model);
    if (shape.kind !== 'document') throw new Error('expected document');
    expect(shape.fields['address']?.kind).toBe('unknown');
  });

  it('restricts fields with selection', () => {
    const model = contract.domain.namespaces.__unbound__!.models['Order'];
    const shape = contractModelToMongoResultShape(model, { selection: ['status', 'amount'] });
    if (shape.kind !== 'document') throw new Error('expected document');
    expect(Object.keys(shape.fields).sort()).toEqual(['amount', 'status']);
  });
});

describe('contractFieldToMongoFieldShape', () => {
  it('union field maps to unknown', () => {
    const f = contractFieldToMongoFieldShape({
      nullable: false,
      type: {
        kind: 'union',
        members: [{ kind: 'scalar', codecId: 'mongo/string@1' }],
      },
    });
    expect(f.kind).toBe('unknown');
  });
});

describe('PipelineChain build resultShape', () => {
  it('identity pipeline attaches document shape from bound model', () => {
    const plan = mongoQuery<TContract>({ contractJson: testContractJson }).from('orders').build();
    expect(plan.resultShape?.kind).toBe('document');
  });

  it('project stage reifies a document shape retaining _id and the projected field', () => {
    const plan = mongoQuery<TContract>({ contractJson: testContractJson })
      .from('orders')
      .match(MongoFieldFilter.eq('status', 'x'))
      .project('status')
      .build();
    expect(plan.command.pipeline.some((s) => s instanceof MongoProjectStage)).toBe(true);
    expect(plan.resultShape).toEqual({
      kind: 'document',
      fields: {
        _id: { kind: 'leaf', codecId: 'mongo/objectId@1', nullable: false },
        status: { kind: 'leaf', codecId: 'mongo/string@1', nullable: false },
      },
    });
  });
});
