import { existsSync } from 'node:fs';
import { MongoClient } from 'mongodb';

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

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();
    if (collections.length === 0) {
      console.log(`Database "${dbName}" has no collections — nothing to drop.`);
      return;
    }

    console.log(`Dropping ${collections.length} collection(s) from "${dbName}"...`);
    for (const col of collections) {
      await db.dropCollection(col.name);
      console.log(`  ✔ ${col.name}`);
    }
    console.log('\nDatabase reset complete. Run `pnpm db:seed` to re-populate.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
