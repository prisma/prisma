import type { MongoFieldShape, MongoResultShape } from '@internal/mongo-query-ast/execution';
import { InsertOneWireCommand } from '@internal/mongo-wire';
import { expectTypeOf, test } from 'vitest';
import type { MongoExecutionPlan } from '../src/mongo-execution-plan';

const meta = {
  target: 'mongo' as const,
  storageHash: 'h',
  lane: 'l',
  paramDescriptors: [],
} as const;

test('MongoExecutionPlan accepts optional resultShape', () => {
  const leaf: MongoFieldShape = { kind: 'leaf', codecId: 'mongo/string@1', nullable: false };
  const doc: MongoResultShape = { kind: 'document', fields: { a: leaf } };
  const plan: MongoExecutionPlan = {
    command: new InsertOneWireCommand('c', {}),
    meta,
    resultShape: doc,
  };
  expectTypeOf(plan.resultShape).toEqualTypeOf<MongoResultShape | undefined>();
});
