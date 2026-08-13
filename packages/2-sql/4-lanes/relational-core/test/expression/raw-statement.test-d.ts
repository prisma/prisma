import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { assertType, test } from 'vitest';
import type { RawSqlLiteral, SqlStatementStats } from '../../src/exports/ast';
import type { AffectedCount } from '../../src/exports/expression';
import { createRawSql, type RawSqlTag } from '../../src/exports/expression';
import type { SqlQueryPlan } from '../../src/exports/plan';

const CONTRACT = {
  target: 'postgres',
  targetFamily: 'sql',
  storage: { storageHash: 'test-storage' },
} as unknown as Contract<SqlStorage>;

const stubInferer = {
  inferCodec(_value: RawSqlLiteral): string {
    return 'test/str';
  },
};

const rawSql = createRawSql(stubInferer, { contract: CONTRACT });
const expressionOnly = createRawSql(stubInferer);

// ── Terminators mint typed plans ─────────────────────────────────────────────

test('.returnsRow() mints a plan keyed by the declared row spec', () => {
  const plan = rawSql`select id, email from "user"`
    .returnsRow({ id: 'pg/int4@1', email: { codecId: 'pg/text@1', nullable: true } })
    .build();

  assertType<SqlQueryPlan<{ id: unknown; email: unknown }>>(plan);
});

test('.affectedCount() mints a plan carrying branded statement stats', () => {
  const plan = rawSql`delete from "user"`.affectedCount().build();

  assertType<SqlQueryPlan<AffectedCount>>(plan);
  // The statistics are readable as such; the brand only says where they came from.
  assertType<SqlStatementStats>(null as unknown as AffectedCount);
});

test('a row spec shaped like statistics does not mint the branded row', () => {
  const plan = rawSql`select 1 as "affectedRows"`.returnsRow({ affectedRows: 'pg/int4@1' });

  // @ts-expect-error — only .affectedCount() mints the branded row type
  assertType<SqlQueryPlan<AffectedCount>>(plan.build());
});

// ── Only row-returning raw queries are embeddable ────────────────────────────

test('a row-returning raw query typechecks as an interpolation', () => {
  const active = rawSql`select id from "user"`.returnsRow({ id: 'pg/int4@1' });

  const plan = rawSql`with active as (${active}) select id from active`
    .returnsRow({ id: 'pg/int4@1' })
    .build();

  assertType<SqlQueryPlan<{ id: unknown }>>(plan);
});

test('an affected-count raw query is rejected as an interpolation', () => {
  const bump = rawSql`update "user" set last_seen = now()`.affectedCount();

  // @ts-expect-error — only row-returning raw queries embed into a template
  rawSql`with bumped as (${bump}) select 1`.returnsRow({ one: 'pg/int4@1' });
});

// ── Nothing builds without a terminator ──────────────────────────────────────

test('an unterminated template has no build()', () => {
  // @ts-expect-error — the template builder builds only through a terminator
  rawSql`select 1`.build();
});

test('a terminated row query has no second terminator', () => {
  const rows = rawSql`select 1 as one`.returnsRow({ one: 'pg/int4@1' });

  // @ts-expect-error — the row query is terminated; it does not re-terminate
  rows.affectedCount();
});

// ── Statement terminators require a plan context ─────────────────────────────

test('the context-free tag exposes the expression terminator only', () => {
  // @ts-expect-error — statement terminators need the plan context createRawSql took
  expressionOnly`select 1`.returnsRow({ one: 'pg/int4@1' });
});

test('the context-free tag has no affected-count terminator', () => {
  // @ts-expect-error — statement terminators need the plan context createRawSql took
  expressionOnly`delete from "user"`.affectedCount();
});

test('the tag type inferred from createRawSql is the expression tag', () => {
  const tag: ReturnType<typeof createRawSql> = expressionOnly;

  assertType<RawSqlTag>(tag);
});
