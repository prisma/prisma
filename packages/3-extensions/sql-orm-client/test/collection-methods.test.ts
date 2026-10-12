import { createPostgresAdapter } from '@internal/adapter-postgres/adapter';
import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { SqlCollectionMethodContribution } from '@internal/sql-relational-core/query-lane-context';
import { websearchToTsquery } from '@internal/target-postgres/full-text';
import { describe, expect, it } from 'vitest';
import type { PostgresContract } from '../../../3-targets/6-adapters/postgres/src/core/types';
import { collectionMethodEntries } from '../src/collection-methods';
import { orm } from '../src/orm';
import { compileSelect, compileSelectWithIncludes } from '../src/query-plan-select';
import type { CollectionState } from '../src/types';
import { notesContract, testTrigramMethod } from './collection-methods-fixture';
import { createCollectionMethodsOrm } from './collection-methods-orm-fixture';
import { createMockRuntime, getTestAggregates, getTestContext, getTestContract } from './helpers';

const adapter = createPostgresAdapter();

function sqlOf(contract: Contract<SqlStorage>, plan: SqlQueryPlan<unknown>): string {
  return adapter.lower(plan.ast, {
    contract: contract as unknown as PostgresContract,
    params: plan.params,
  }).sql;
}

const contract = getTestContract();

function usersSql(state: CollectionState): string {
  return sqlOf(contract, compileSelect(contract, 'public', 'User', 'users', state));
}

const search = `(setweight(to_tsvector('english', coalesce("users"."name", '')), 'A') || setweight(to_tsvector('english', coalesce("users"."email", '')), 'B'))`;
const q = websearchToTsquery('alice');

describe('using', () => {
  const { plain, notes, unlisted } = createCollectionMethodsOrm();

  it('has one method for each index a registered contribution matches', () => {
    expect({
      user: Object.keys(plain.User.using),
      post: Object.keys(plain.Post.using),
      note: Object.keys(notes.Note.using),
      memo: Object.keys(notes.Note.variant('memo').using),
      tag: Object.keys(notes.Tag.using),
      unlisted: Object.keys(unlisted.User.using),
    }).toEqual({
      user: ['users_search'],
      post: [],
      note: ['notes_search', 'notes_title_trgm'],
      memo: ['notes_search', 'notes_title_trgm'],
      tag: [],
      unlisted: ['users_search'],
    });
  });

  it('works out the methods of a table once per execution context', () => {
    const context = getTestContext();
    expect(collectionMethodEntries(context, 'public', 'users')).toBe(
      collectionMethodEntries(context, 'public', 'users'),
    );
  });
});

describe('a contributed method', () => {
  const { db, plain, notes } = createCollectionMethodsOrm();

  it('filters by the index and orders by its relevance, binding the query once', () => {
    const users = plain.User.select('id').using.users_search(q);

    expect(usersSql(users.state)).toBe(
      `SELECT "users"."id" AS "id" FROM "public"."users" WHERE ${search} @@ websearch_to_tsquery('english', $1) ORDER BY ts_rank(${search}, websearch_to_tsquery('english', $1)) DESC`,
    );
  });

  it('appends a later orderBy after the relevance order', () => {
    const users = plain.User.select('id')
      .using.users_search(q)
      .orderBy((u) => u.id.asc());

    expect(usersSql(users.state)).toBe(
      `SELECT "users"."id" AS "id" FROM "public"."users" WHERE ${search} @@ websearch_to_tsquery('english', $1) ORDER BY ts_rank(${search}, websearch_to_tsquery('english', $1)) DESC, "users"."id" ASC`,
    );
  });

  it('puts an earlier orderBy before the relevance order', () => {
    const users = plain.User.select('id')
      .orderBy((u) => u.id.asc())
      .using.users_search(q);

    expect(usersSql(users.state)).toBe(
      `SELECT "users"."id" AS "id" FROM "public"."users" WHERE ${search} @@ websearch_to_tsquery('english', $1) ORDER BY "users"."id" ASC, ts_rank(${search}, websearch_to_tsquery('english', $1)) DESC`,
    );
  });

  it('combines with a filter from a custom collection method, on this', () => {
    const users = db.User.named('Alice').relevant(q).select('id');

    expect(usersSql(users.state)).toBe(
      `SELECT "users"."id" AS "id" FROM "public"."users" WHERE ("users"."name" = $1 AND ${search} @@ websearch_to_tsquery('english', $2)) ORDER BY ts_rank(${search}, websearch_to_tsquery('english', $2)) DESC`,
    );
  });

  it('gives the same query inside with and inside a fragment for one model', () => {
    const direct = plain.User.using.users_search(q).select('id');
    const viaWith = plain.User.with((users) => users.using.users_search(q)).select('id');
    const viaFragment = plain.User.with(
      plain.User.fragment((users) => users.using.users_search(q)),
    ).select('id');

    expect({ viaWith: usersSql(viaWith.state), viaFragment: usersSql(viaFragment.state) }).toEqual({
      viaWith: usersSql(direct.state),
      viaFragment: usersSql(direct.state),
    });
  });

  it('binds the index to the related table inside an include refinement', () => {
    const users = plain.User.select('id').include('invitedUsers', (invited) =>
      invited.select('id').using.users_search(q).limit(3),
    );

    const sql = sqlOf(
      contract,
      compileSelectWithIncludes(
        contract,
        getTestAggregates(),
        'public',
        'User',
        'users',
        users.state,
      ),
    );
    const child = `(setweight(to_tsvector('english', coalesce("invitedUsers__child"."name", '')), 'A') || setweight(to_tsvector('english', coalesce("invitedUsers__child"."email", '')), 'B'))`;
    const rank = `ts_rank(${child}, websearch_to_tsquery('english', $1))`;
    expect(sql).toBe(
      `SELECT "users"."id" AS "id", (SELECT coalesce(json_agg(json_build_object('id', "invitedUsers__rows"."id") ORDER BY "invitedUsers__rows"."invitedUsers__order_0" DESC), json_build_array()) AS "invitedUsers" FROM (SELECT "invitedUsers__child"."id" AS "id", ${rank} AS "invitedUsers__order_0" FROM "public"."users" AS "invitedUsers__child" WHERE ("invitedUsers__child"."invited_by_id" = "users"."id" AND ${child} @@ websearch_to_tsquery('english', $1)) ORDER BY ${rank} DESC LIMIT 3) AS "invitedUsers__rows") AS "invitedUsers" FROM "public"."users"`,
    );
  });

  it('comes from a second index type the ORM client does not know', () => {
    const notesSchema = notesContract();
    const found = notes.Note.select('id').using.notes_title_trgm('title', 'zebra');

    expect(
      sqlOf(notesSchema, compileSelect(notesSchema, 'public', 'Note', 'notes', found.state)),
    ).toBe(
      'SELECT "notes"."id" AS "id" FROM "public"."notes" WHERE "notes"."title" = $1 ORDER BY similarity("notes"."title", $2) DESC',
    );
  });
});

describe('the ORM client', () => {
  const runtime = createMockRuntime();
  const context = getTestContext();
  const fullText = context.collectionMethods?.[0];
  if (fullText === undefined) throw new Error('the Postgres target contributes no method');

  it('refuses two contributions with the same id', () => {
    expect(() =>
      orm({
        runtime,
        context: {
          ...context,
          collectionMethods: [fullText, testTrigramMethod, testTrigramMethod],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'ORM.ARGUMENT_INVALID',
        message: 'Two collection method contributions have the id "test/trigram".',
        why: 'A contribution is registered under its id in CollectionMethodRegistry, so an id names one contribution.',
        fix: 'List each extension once, or give one of the two contributions another id.',
        meta: { id: 'test/trigram' },
      }),
    );
  });

  it('refuses two contributions that match the same index', () => {
    const otherFullText: SqlCollectionMethodContribution = {
      ...fullText,
      id: 'test/other-full-text',
    };

    expect(() =>
      orm({ runtime, context: { ...context, collectionMethods: [fullText, otherFullText] } }),
    ).toThrow(
      expect.objectContaining({
        code: 'ORM.ARGUMENT_INVALID',
        message:
          'Index "users_search" of table "users" is matched by more than one collection method contribution: "postgres/fullText", "test/other-full-text".',
        why: 'An index gets one collection method under `using`, named after the index, so only one contribution may match it.',
        fix: 'Remove one of the extensions that contribute these methods.',
        meta: {
          namespaceId: 'public',
          tableName: 'users',
          index: 'users_search',
          contributions: ['postgres/fullText', 'test/other-full-text'],
        },
      }),
    );
  });

  it('accepts a context with no contributions', () => {
    const client = orm({ runtime, context: { ...context, collectionMethods: [] } });
    expect(Object.keys(client.public.User.using)).toEqual([]);
  });
});
