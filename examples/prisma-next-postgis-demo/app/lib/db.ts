import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import pg from 'pg';
import { db } from '../../src/prisma/db';

let runtimePromise: Promise<Runtime> | undefined;

export function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    const url = getDatabaseUrl();
    runtimePromise = db.connect({ url }).catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

export async function getPostgisVersion(): Promise<string | null> {
  const client = new pg.Client({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    const result = await client.query<{ v: string }>('SELECT PostGIS_Full_Version() AS v');
    const raw = result.rows[0]?.v ?? '';
    const match = raw.match(/POSTGIS="([^"\s]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

function getDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env or export DATABASE_URL.');
  }
  return url;
}
