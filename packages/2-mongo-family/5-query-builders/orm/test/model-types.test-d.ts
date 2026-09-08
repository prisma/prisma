import type { ResultType } from '@internal/framework-components/runtime';
import type { Scalars, With } from '@internal/mongo-contract';
import type { SimplifyDeep } from '@internal/utils/simplify-deep';
import { expectTypeOf, test } from 'vitest';
import type {
  Contract,
  Models,
} from '../../../1-foundation/mongo-contract/test/fixtures/orm-contract';
import type { MongoOrmClient } from '../src/mongo-orm';
import type { InferFullRow, VariantModelRow } from '../src/types';

declare const db: MongoOrmClient<Contract>;

test('InferFullRow, flattened, equals Scalars of the emitted model for every model', () => {
  expectTypeOf<SimplifyDeep<InferFullRow<Contract, 'User'>>>().toEqualTypeOf<
    Scalars<Models.unbound_User>
  >();
  expectTypeOf<SimplifyDeep<InferFullRow<Contract, 'Address'>>>().toEqualTypeOf<
    Scalars<Models.unbound_Address>
  >();
  expectTypeOf<SimplifyDeep<InferFullRow<Contract, 'Comment'>>>().toEqualTypeOf<
    Scalars<Models.unbound_Comment>
  >();
  expectTypeOf<VariantModelRow<Contract, 'Task', 'Bug'>>().toEqualTypeOf<
    Scalars<Models.unbound_Bug>
  >();
  expectTypeOf<VariantModelRow<Contract, 'Task', 'Feature'>>().toEqualTypeOf<
    Scalars<Models.unbound_Feature>
  >();
});

test('embeds are present in Scalars', () => {
  expectTypeOf<Scalars<Models.unbound_User>>().toHaveProperty('addresses');
  expectTypeOf<Scalars<Models.unbound_Task>>().toHaveProperty('comments');
});

test('ResultType of a root collection equals Scalars of the emitted model and is not never', () => {
  expectTypeOf<ResultType<typeof db.users>>().not.toBeNever();
  expectTypeOf<ResultType<typeof db.users>>().toEqualTypeOf<Scalars<Models.unbound_User>>();
  expectTypeOf<ResultType<typeof db.tasks>>().not.toBeNever();
  expectTypeOf<ResultType<typeof db.tasks>>().toEqualTypeOf<Scalars<Models.unbound_AnyTask>>();
});

test('ResultType of a reference include equals With', () => {
  const withAssignee = db.tasks.include('assignee');
  expectTypeOf<ResultType<typeof withAssignee>>().toEqualTypeOf<
    With<Models.unbound_AnyTask, 'assignee'>
  >();
});
