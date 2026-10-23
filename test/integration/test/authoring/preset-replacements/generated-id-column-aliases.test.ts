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

describe('a generated id column alias on a key and the foreign key that copies it', () => {
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

function diagnosticsOf(interpret: (schema: string) => Interpreted, field: string) {
  const interpreted = interpret(`model Token {\n  id    Int @id\n  value ${field}\n}\n`);
  return interpreted.ok
    ? []
    : interpreted.failure.diagnostics.map(({ code, message }) => ({ code, message }));
}

describe('a generator on a generated id column alias', () => {
  it.each([
    [
      'Ulid @onCreate(uuid())',
      'uuid() writes 36 characters, which does not fit a column of 26 characters.',
    ],
    [
      'sql.Ulid @onCreate(uuid())',
      'uuid() writes 36 characters, which does not fit a column of 26 characters.',
    ],
    [
      'Nanoid @onCreate(nanoid(30))',
      'nanoid(30) writes 30 characters, which does not fit a column of 21 characters.',
    ],
  ] as const)(
    'is refused on postgres when it writes more than the alias stores: %s',
    (field, message) => {
      expect(diagnosticsOf(interpretPostgres, field)).toEqual([
        { code: 'PSL_GENERATOR_NOT_APPLICABLE', message: `Field "Token.value": ${message}` },
      ]);
    },
  );
});
