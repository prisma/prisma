import { Collection } from '@internal/sql-orm-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Contract } from './fixtures/generated/contract';
import fixtureContractJson from './fixtures/generated/contract.json' with { type: 'json' };

const statements = vi.hoisted(() => [] as string[]);

vi.mock('pg', () => {
  const query = vi.fn(async (request: string | { readonly text: string }) => {
    statements.push(typeof request === 'string' ? request : request.text);
    return { rows: [], rowCount: 0 };
  });
  class Pool {
    on = vi.fn().mockReturnThis();
    connect = vi.fn().mockResolvedValue({ query, release: vi.fn(), on: vi.fn(), off: vi.fn() });
    end = vi.fn().mockResolvedValue(undefined);
    totalCount = 0;
    idleCount = 0;
    waitingCount = 0;
  }
  class Client {
    on = vi.fn().mockReturnThis();
    connect = vi.fn().mockResolvedValue(undefined);
    query = query;
    end = vi.fn().mockResolvedValue(undefined);
    release = vi.fn();
  }
  return { Pool, Client };
});

import postgres from '../src/exports/runtime';
import postgresServerless from '../src/exports/serverless';
import { contractFromJson } from '../src/exports/static';

class PostCollection extends Collection<Contract, 'Post'> {
  titled(title: string) {
    return this.where({ title });
  }
}

const contract = contractFromJson<Contract>(fixtureContractJson);
const collections = { Post: PostCollection };
const url = 'postgres://localhost:5432/db';

function lastSelect(): string | undefined {
  return statements.filter((statement) => statement.startsWith('SELECT')).at(-1);
}

afterEach(() => {
  statements.length = 0;
});

describe('a postgres client with custom collection classes', () => {
  it('runs a class method on db.orm', async () => {
    const db = postgres({ contract, url, verifyMarker: false, collections });

    await db.orm.public.Post.titled('Hello').all();
    await db.close();

    expect({
      collection: db.orm.public.Post instanceof PostCollection,
      filtersByTitle: lastSelect()?.includes('"title"'),
    }).toEqual({ collection: true, filtersByTitle: true });
  });

  it('runs a class method on tx.orm, and keeps the class through a row lock', async () => {
    const db = postgres({ contract, url, verifyMarker: false, collections });

    const isPostCollection = await db.transaction(async (tx) => {
      await tx.orm.public.Post.titled('Hello').forUpdate().all();
      return tx.orm.public.Post.titled('Hello').forUpdate() instanceof PostCollection;
    });
    await db.close();

    expect({ isPostCollection, statements }).toEqual({
      isPostCollection: true,
      statements: [
        'BEGIN',
        expect.stringMatching(/WHERE "posts"\."title" = \$1 FOR UPDATE OF "posts"$/),
        'COMMIT',
      ],
    });
  });
});

describe('a serverless client with custom collection classes', () => {
  it('runs a class method on a connection and on its transactions', async () => {
    const serverless = postgresServerless({ contract, verifyMarker: false, collections });
    await using db = await serverless.connect({ url });

    await db.orm.public.Post.titled('Hello').all();
    const inTransaction = await db.transaction(
      async (tx) => tx.orm.public.Post instanceof PostCollection,
    );

    expect({
      connection: db.orm.public.Post instanceof PostCollection,
      inTransaction,
      filtersByTitle: lastSelect()?.includes('"title"'),
    }).toEqual({ connection: true, inTransaction: true, filtersByTitle: true });
  });
});
