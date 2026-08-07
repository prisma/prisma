/**
 * Type-tests: ORM aggregate availability comes from the contract's emitted
 * aggregate map, not from codec traits.
 *
 * The map is the target's declaration, so a textual extremum the target
 * declares is admitted, a pair it never declared is unsayable at the call
 * site, a contract emitted without aggregate types cannot invoke aggregates
 * at all, and same-named models in different namespaces resolve their own
 * facet's columns rather than a cross-namespace union.
 */

import type { TypeMapsPhantomKey } from '@internal/sql-contract/types';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import { expectTypeOf, test } from 'vitest';
import { Collection } from '../src/collection';
import type {
  AggregateBuilder,
  AggregateIncludeReducers,
  AggregateSelector,
  HavingBuilder,
  IncludeScalar,
} from '../src/types';
import { createMockRuntime, type TestContract } from './helpers';

declare const agg: AggregateBuilder<TestContract, 'User'>;
declare const having: HavingBuilder<TestContract, 'User'>;

test('a declared textual extremum is admitted with its declared result type', () => {
  expectTypeOf(agg.max('name')).toEqualTypeOf<AggregateSelector<string | null>>();
});

test('a declared numeric average reads its declared decimal-string result', () => {
  expectTypeOf(agg.avg('id')).toEqualTypeOf<AggregateSelector<string | null>>();
});

test('count() reads the declared without-input row', () => {
  expectTypeOf(agg.count()).toEqualTypeOf<AggregateSelector<bigint>>();
});

test('a pair the target never declared is unsayable', () => {
  // @ts-expect-error — the target declares no sum over pg/text@1
  agg.sum('name');
});

test('the HAVING surface admits the same declared fields', () => {
  having.max('name');
  // @ts-expect-error — the target declares no sum over pg/text@1
  having.sum('name');
});

type ContractSansAggregates = Omit<TestContract, TypeMapsPhantomKey>;
declare const bareAgg: AggregateBuilder<ContractSansAggregates, 'User'>;
declare const bareHaving: HavingBuilder<ContractSansAggregates, 'User'>;
declare const bareReducers: AggregateIncludeReducers<ContractSansAggregates, 'Post'>;

test('a contract emitted without aggregate types cannot invoke count()', () => {
  // @ts-expect-error — the contract declares no aggregate rows
  bareAgg.count();
});

test('a contract emitted without aggregate types cannot invoke field aggregates', () => {
  // @ts-expect-error — the contract declares no aggregate rows
  bareAgg.sum('id');
});

test('a contract emitted without aggregate types carries no index signature', () => {
  // @ts-expect-error — an unknown map yields no index signature, so the name is a property error
  bareAgg['whoops'];
  // @ts-expect-error — an unknown map yields no index signature, so the name is a property error
  bareHaving['whoops'];
  // @ts-expect-error — an unknown map yields no index signature, so the name is a property error
  bareReducers['whoops'];
});

// Same-named model and field in two namespaces, with different codecs: each
// namespace facet must resolve its own column, not a cross-namespace union.
type PublicStorageNs = TestContract['storage']['namespaces']['public'];
type UsersTable = PublicStorageNs['entries']['table']['users'];
type FloatIdUsersTable = Omit<UsersTable, 'columns'> & {
  readonly columns: Omit<UsersTable['columns'], 'id'> & {
    readonly id: Omit<UsersTable['columns']['id'], 'codecId'> & {
      readonly codecId: 'pg/float8@1';
    };
  };
};
type AuthStorageNs = Omit<PublicStorageNs, 'entries'> & {
  readonly entries: Omit<PublicStorageNs['entries'], 'table'> & {
    readonly table: Omit<PublicStorageNs['entries']['table'], 'users'> & {
      readonly users: FloatIdUsersTable;
    };
  };
};
type TwoNamespaceContract = Omit<TestContract, 'domain' | 'storage'> & {
  readonly domain: Omit<TestContract['domain'], 'namespaces'> & {
    readonly namespaces: {
      readonly public: TestContract['domain']['namespaces']['public'];
      readonly auth: TestContract['domain']['namespaces']['public'];
    };
  };
  readonly storage: Omit<TestContract['storage'], 'namespaces'> & {
    readonly namespaces: {
      readonly public: PublicStorageNs;
      readonly auth: AuthStorageNs;
    };
  };
};

declare const publicAgg: AggregateBuilder<TwoNamespaceContract, 'User', 'public'>;
declare const authAgg: AggregateBuilder<TwoNamespaceContract, 'User', 'auth'>;

test('each namespace facet resolves its own column codec for the same field name', () => {
  // public User.id is pg/int4@1, whose sum widens to pg/int8@1 (bigint).
  expectTypeOf(publicAgg.sum('id')).toEqualTypeOf<AggregateSelector<bigint | null>>();
  // auth User.id is pg/float8@1, whose sum stays pg/float8@1 (number).
  expectTypeOf(authAgg.sum('id')).toEqualTypeOf<AggregateSelector<number | null>>();
});

// The include scalar reducers read the same declaration surface as the
// top-level builder: what a refinement admits is what the contract's
// aggregate map declares for the related model's fields.
const runtime = createMockRuntime();
const executionContext = {} as ExecutionContext<TestContract>;
const users = new Collection({ runtime, context: executionContext }, 'User', {
  namespaceId: 'public',
});

test('include reducers admit a declared textual extremum with its declared result', () => {
  users.include('posts', (posts) => {
    expectTypeOf(posts.min('title')).toEqualTypeOf<IncludeScalar<string | null>>();
    return posts.max('title');
  });
});

test('include reducers read the declared widened result for a numeric sum', () => {
  users.include('posts', (posts) => {
    // Post.views is pg/int4@1, whose sum widens to pg/int8@1 (bigint).
    expectTypeOf(posts.sum('views')).toEqualTypeOf<IncludeScalar<bigint | null>>();
    return posts.sum('views');
  });
});

test('include reducers reject a pair the target never declared', () => {
  users.include('posts', (posts) => {
    // @ts-expect-error — the target declares no sum over pg/text@1
    return posts.sum('title');
  });
});
