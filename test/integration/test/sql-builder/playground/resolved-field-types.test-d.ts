import type { Vector } from '@internal/extension-pgvector/codec-types';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { Char } from '@internal/target-postgres/codec-types';
import { assertType, expectTypeOf, test } from 'vitest';
import { db } from './preamble';

type ExtractRow<T> = T extends SqlQueryPlan<infer R> ? R : never;

test('SELECT resolves Vector column to concrete type via FieldOutputTypes', () => {
  const result = db.public.posts.select('id', 'embedding').build();
  assertType<{ id: number; embedding: Vector | null }>(
    null as unknown as ExtractRow<typeof result>,
  );
});

test('SELECT resolves parameterized Char column to concrete type via FieldOutputTypes', () => {
  const result = db.public.articles.select('id', 'title').build();
  expectTypeOf<ExtractRow<typeof result>>().toEqualTypeOf<{
    id: Char<36>;
    title: string;
  }>();
});

test('INSERT accepts concrete input types via FieldInputTypes', () => {
  db.public.posts.insert([
    {
      id: 1,
      title: 'test',
      user_id: 1,
      views: 0,
      embedding: [1, 2, 3] as unknown as Vector,
    },
  ]);
});

test('INSERT returning resolves to concrete output types', () => {
  const result = db.public.posts
    .insert([{ id: 1, title: 'test', user_id: 1, views: 0 }])
    .returning('id', 'embedding')
    .build();
  assertType<{ id: number; embedding: Vector | null }>(
    null as unknown as ExtractRow<typeof result>,
  );
});

test('UPDATE returning resolves to concrete output types', () => {
  const result = db.public.posts.update({ views: 10 }).returning('id', 'embedding').build();
  assertType<{ id: number; embedding: Vector | null }>(
    null as unknown as ExtractRow<typeof result>,
  );
});

test('DELETE returning resolves to concrete output types', () => {
  const result = db.public.posts.delete().returning('id', 'embedding').build();
  assertType<{ id: number; embedding: Vector | null }>(
    null as unknown as ExtractRow<typeof result>,
  );
});
