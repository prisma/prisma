import type { InferModelRow } from '@internal/mongo-contract';
import { expectTypeOf, test } from 'vitest';
import type {
  Contract,
  HomeAddressOutput,
} from '../../1-foundation/mongo-contract/test/fixtures/orm-contract';

test('InferModelRow resolves Task fields', () => {
  type TaskRow = InferModelRow<Contract, 'Task'>;
  expectTypeOf({} as TaskRow).toExtend<{
    _id: string;
    title: string;
    type: string;
    assigneeId: string;
  }>();
});

test('InferModelRow resolves User fields', () => {
  type UserRow = InferModelRow<Contract, 'User'>;
  expectTypeOf<UserRow['_id']>().toEqualTypeOf<string>();
  expectTypeOf<UserRow['name']>().toEqualTypeOf<string>();
  expectTypeOf<UserRow['email']>().toEqualTypeOf<string>();
  expectTypeOf<UserRow['loginCount']>().toEqualTypeOf<number>();
});

test('HomeAddressOutput matches emitted value-object row shape', () => {
  expectTypeOf<HomeAddressOutput['city']>().toEqualTypeOf<string>();
  expectTypeOf<HomeAddressOutput['country']>().toEqualTypeOf<string>();
});

test('InferModelRow resolves embedded model fields', () => {
  type AddressRow = InferModelRow<Contract, 'Address'>;
  expectTypeOf({} as AddressRow).toExtend<{
    street: string;
    city: string;
    zip: string;
  }>();
});

test('InferModelRow resolves variant model fields', () => {
  type BugRow = InferModelRow<Contract, 'Bug'>;
  type FeatureRow = InferModelRow<Contract, 'Feature'>;
  expectTypeOf({} as BugRow).toExtend<{ severity: string }>();
  expectTypeOf({} as FeatureRow).toExtend<{
    priority: string;
    targetRelease: string;
  }>();
});

test('InferModelRow resolves Comment with date field', () => {
  type CommentRow = InferModelRow<Contract, 'Comment'>;
  expectTypeOf({} as CommentRow).toExtend<{
    _id: string;
    text: string;
    createdAt: Date;
  }>();
});
