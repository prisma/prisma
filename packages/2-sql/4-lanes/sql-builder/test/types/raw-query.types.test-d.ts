/**
 * Type-test: a whole-query raw statement resolves its row type from what the
 * spec declares — contract column references inherit the contract's codec,
 * nullability, and output type; explicit codec ids resolve through the same
 * codec-type map the query builders read.
 */

import type { ResultType } from '@internal/framework-components/runtime';
import type { SqlStatementStats } from '@internal/sql-relational-core/ast';
import { expectTypeOf, test } from 'vitest';
import type { Db } from '../../src/exports/types';
import type { Contract } from '../fixtures/generated/contract';

declare const db: Db<Contract>;

const users = db.public.users;

test('a contract column reference inherits its output type', () => {
  const plan = db.raw`SELECT id, email FROM users`
    .returnsRow({ id: users.columns.id, email: users.columns.email })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['id']>().toEqualTypeOf<number>();
  expectTypeOf<Row['email']>().toEqualTypeOf<string>();
  expectTypeOf<keyof Row>().toEqualTypeOf<'id' | 'email'>();
});

test('a nullable contract column reference resolves to a nullable type', () => {
  const plan = db.raw`SELECT invited_by_id FROM users`
    .returnsRow({ invited_by_id: users.columns.invited_by_id })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['invited_by_id']>().toEqualTypeOf<number | null>();
});

test('an explicit codec id resolves through the contract codec-type map', () => {
  const plan = db.raw`SELECT count(*) AS order_count FROM posts`
    .returnsRow({ order_count: 'pg/int8@1' })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['order_count']>().toEqualTypeOf<bigint>();
});

test('an explicit entry declaring nullability widens its resolved type', () => {
  const plan = db.raw`SELECT max(views) AS top FROM posts`
    .returnsRow({ top: { codecId: 'pg/int4@1', nullable: true } })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['top']>().toEqualTypeOf<number | null>();
});

test('a mixed spec resolves each entry by its own form', () => {
  const plan = db.raw`
    SELECT u.id, u.email, count(p.id) AS post_count
    FROM users u JOIN posts p ON p.user_id = u.id
    GROUP BY u.id, u.email
  `
    .returnsRow({
      id: users.columns.id,
      email: users.columns.email,
      post_count: 'pg/int8@1',
    })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['id']>().toEqualTypeOf<number>();
  expectTypeOf<Row['email']>().toEqualTypeOf<string>();
  expectTypeOf<Row['post_count']>().toEqualTypeOf<bigint>();
  expectTypeOf<keyof Row>().toEqualTypeOf<'id' | 'email' | 'post_count'>();
});

test('an affected-count statement mints a statement-stats plan', () => {
  const plan = db.raw`UPDATE users SET name = ${'Ada'} WHERE id = ${1}`.affectedCount().build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row>().toEqualTypeOf<SqlStatementStats>();
  expectTypeOf<Row['affectedRows']>().toEqualTypeOf<number>();
});

test('a row-returning statement interpolates into another template', () => {
  const invited = db.raw`SELECT id, email FROM users WHERE invited_by_id = ${1}`.returnsRow({
    id: users.columns.id,
    email: users.columns.email,
  });

  const plan = db.raw`WITH invited AS (${invited}) SELECT count(*) AS n FROM invited`
    .returnsRow({ n: 'pg/int8@1' })
    .build();
  type Row = ResultType<typeof plan>;

  expectTypeOf<Row['n']>().toEqualTypeOf<bigint>();
});

test('an affected-count statement is rejected as an interpolation', () => {
  const bump = db.raw`UPDATE users SET name = ${'Ada'}`.affectedCount();

  // @ts-expect-error — only row-returning raw statements embed into a template
  db.raw`WITH bumped AS (${bump}) SELECT 1`.returnsRow({ one: 'pg/int4@1' });
});

test('an unterminated template has no build()', () => {
  // @ts-expect-error — the template builds only through a terminator
  db.raw`SELECT 1`.build();
});

test('a column reference from the table proxy carries the contract codec id', () => {
  expectTypeOf(users.columns.id.codecId).toEqualTypeOf<'pg/int4@1'>();
  expectTypeOf(users.columns.invited_by_id.nullable).toEqualTypeOf<true>();
  expectTypeOf(users.columns.id.nullable).toEqualTypeOf<false>();
});
