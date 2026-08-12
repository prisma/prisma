import { existsSync } from 'node:fs';
import { createClient } from '../src/db';
import { seed } from '../src/seed';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main() {
  const url = process.env['DB_URL'];
  if (!url) {
    console.error('DB_URL is required. Set it in your environment or .env file.');
    process.exit(1);
  }

  const dbName = process.env['MONGODB_DB'] ?? 'retail-store';

  console.log('Connecting to MongoDB...');
  const db = createClient(url, dbName);

  try {
    console.log('Seeding data...');
    await seed(db);
    console.log('Seed complete.');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
