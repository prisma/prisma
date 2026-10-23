import type { Contract } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  emitPostgres,
  emitSqlite,
  type Interpreted,
  interpretPostgres,
  interpretSqlite,
} from './preset-replacement-contracts';

const ALIASES = [
  ['UuidString', 36, 'uuid()'],
  ['Ulid', 26, 'ulid()'],
  ['Nanoid', 21, 'nanoid()'],
  ['Cuid2', 24, 'cuid(2)'],
  ['Ksuid', 27, 'ksuid()'],
] as const;

function schema(column: string, generator: string): string {
  return `model Author {
  id    ${column} @id @onCreate(${generator})
  posts Post[]
}

model Post {
  id       Int     @id
  authorId ${column}
  author   Author  @relation(fields: [authorId], references: [id])
}
`;
}

async function emitted(
  interpret: (schema: string) => Interpreted,
  emit: (contract: Contract) => Promise<string>,
  source: string,
): Promise<unknown> {
  const interpreted = interpret(source);
  if (!interpreted.ok) {
    throw new Error(`the schema did not interpret: ${JSON.stringify(interpreted.failure)}`);
  }
  return JSON.parse(await emit(interpreted.value));
}

describe('an identifier type alias on a key and the foreign key that copies it', () => {
  it.each(ALIASES)(
    'on postgres, %s emits the contract Char(%i) emits',
    async (alias, length, generator) => {
      expect(await emitted(interpretPostgres, emitPostgres, schema(alias, generator))).toEqual(
        await emitted(interpretPostgres, emitPostgres, schema(`Char(${length})`, generator)),
      );
    },
  );

  it.each(ALIASES)(
    'on postgres, sql.%s emits the contract Char(%i) emits',
    async (alias, length, generator) => {
      expect(
        await emitted(interpretPostgres, emitPostgres, schema(`sql.${alias}`, generator)),
      ).toEqual(
        await emitted(interpretPostgres, emitPostgres, schema(`Char(${length})`, generator)),
      );
    },
  );

  it.each(ALIASES)(
    'on sqlite, sql.%s emits the contract sql.Char(%i) emits',
    async (alias, length, generator) => {
      expect(await emitted(interpretSqlite, emitSqlite, schema(`sql.${alias}`, generator))).toEqual(
        await emitted(interpretSqlite, emitSqlite, schema(`sql.Char(${length})`, generator)),
      );
    },
  );
});
