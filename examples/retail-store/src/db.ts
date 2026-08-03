import { createCacheMiddleware } from '@prisma/orm-extension-middleware-cache';
import mongo from '@prisma/orm-mongo/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };

export function createClient(connectionUri: string, dbName: string) {
  return mongo<Contract>({
    contractJson,
    url: connectionUri,
    dbName,
    middleware: [createCacheMiddleware()],
  });
}

export type Db = ReturnType<typeof createClient>;

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = process.env['DB_URL'] ?? 'mongodb://localhost:27017';
    const dbName = process.env['MONGODB_DB'] ?? 'retail-store';
    db = createClient(url, dbName);
  }
  return db;
}
