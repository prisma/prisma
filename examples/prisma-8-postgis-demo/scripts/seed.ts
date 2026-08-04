/**
 * Database Seed Script
 *
 * Populates the demo database with five cafes, three neighborhoods, and
 * two routes — all real San Francisco coordinates in WGS84.
 *
 * Run with: pnpm seed
 *
 * Prerequisites:
 *   - `pnpm db:up` (PostgreSQL+PostGIS via Docker)
 *   - `pnpm emit && pnpm db:init`
 *   - DATABASE_URL set (copy `.env.example` to `.env`)
 */
import 'dotenv/config';

import { loadAppConfig } from '../src/app-config';
import { db } from '../src/prisma/db';
import { cafes, neighborhoods, routes } from '../src/seed-data';

async function main() {
  const { databaseUrl } = loadAppConfig();
  const runtime = await db.connect({ url: databaseUrl });

  try {
    for (const cafe of cafes) {
      await runtime.execute(db.sql.public.cafe.insert([cafe]).build());
    }
    console.log(`Seeded ${cafes.length} cafes`);

    for (const hood of neighborhoods) {
      await runtime.execute(db.sql.public.neighborhood.insert([hood]).build());
    }
    console.log(`Seeded ${neighborhoods.length} neighborhoods`);

    for (const route of routes) {
      await runtime.execute(db.sql.public.route.insert([route]).build());
    }
    console.log(`Seeded ${routes.length} routes`);

    console.log('\nSeed completed successfully!');
  } finally {
    await runtime.close();
  }
}

main().catch((e) => {
  console.error('Error seeding database:', e);
  process.exitCode = 1;
});
