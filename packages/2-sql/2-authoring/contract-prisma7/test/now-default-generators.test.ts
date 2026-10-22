import { describe, expect, it } from 'vitest';
import { interpretSchemaText, interpretSchemaTextResult, serializedTable } from './support';

const now = (id: string, params?: Record<string, unknown>) =>
  params === undefined ? { kind: 'generator', id } : { kind: 'generator', id, params };
const ref = (field: string) => ({ namespace: 'public', entry: 'Post', field });
const databaseNow = { kind: 'function', expression: 'now()' };

describe('@default(now()) on Postgres', () => {
  it('lowers to the database default now() and the now generator on create, resolved by codec', () => {
    const contract = interpretSchemaText(`datasource db {
  provider = "postgresql"
}

model Post {
  id         Int       @id
  createdAt  DateTime  @default(now())
  optionalAt DateTime? @default(now())
  zonedAt    DateTime  @default(now()) @db.Timestamptz(6)
  day        DateTime  @default(now()) @db.Date
  clock      DateTime  @default(now()) @db.Time(0)
}
`);
    const { columns } = serializedTable(contract, 'Post');
    expect(
      Object.fromEntries(
        ['createdAt', 'optionalAt', 'zonedAt', 'day', 'clock'].map((name) => [
          name,
          columns[name]?.['default'],
        ]),
      ),
    ).toEqual({
      createdAt: databaseNow,
      optionalAt: databaseNow,
      zonedAt: databaseNow,
      day: databaseNow,
      clock: databaseNow,
    });
    expect(contract.execution?.mutations.defaults).toEqual([
      { ref: ref('clock'), onCreate: now('timeStringNow', { precision: 0 }) },
      { ref: ref('createdAt'), onCreate: now('timestampStringNow') },
      { ref: ref('day'), onCreate: now('dateStringNow') },
      { ref: ref('optionalAt'), onCreate: now('timestampStringNow') },
      { ref: ref('zonedAt'), onCreate: now('timestamptzStringNow') },
    ]);
  });

  it('keeps the database default and writes now on create and on update with @updatedAt', () => {
    const contract = interpretSchemaText(`datasource db {
  provider = "postgresql"
}

model Post {
  id        Int      @id
  updatedAt DateTime @default(now()) @updatedAt
}
`);
    expect(serializedTable(contract, 'Post').columns['updatedAt']?.['default']).toEqual(
      databaseNow,
    );
    expect(contract.execution?.mutations.defaults).toEqual([
      {
        ref: ref('updatedAt'),
        onCreate: now('timestampStringNow'),
        onUpdate: now('timestampStringNow'),
      },
    ]);
  });

  it('is refused on a column no now generator fills', () => {
    const result = interpretSchemaTextResult(`datasource db {
  provider = "postgresql"
}

model Post {
  id    Int    @id
  title String @default(now())
}
`);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.failure.diagnostics.map(({ message }) => message)).toEqual([
      'Field "Post.title": @default function "now()" cannot fill a column of codec "pg/text@1".',
    ]);
  });
});
