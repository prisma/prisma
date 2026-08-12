import { existsSync } from 'node:fs';
import { createClient } from '../src/db';
import { getAuthorLeaderboard } from '../src/queries';
import { seed } from '../src/seed';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const DB_NAME = 'blog';

async function main() {
  const url = process.env['MONGODB_URL'];
  if (!url) {
    console.error('MONGODB_URL is required. Set it in your environment or .env file.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const db = createClient({ url, dbName: DB_NAME });

  try {
    console.log('Seeding data...');
    await seed(db.orm);
    console.log('Seed complete.');

    const runtime = await db.runtime();
    const rows = await getAuthorLeaderboard(db, runtime);

    console.log('\nAuthor leaderboard:');
    for (const row of rows) {
      const authors = row.author as Array<{ name: string }>;
      const name = authors[0]?.name ?? 'Unknown';
      console.log(
        `  ${name.padEnd(16)} posts=${row.postCount}  latest=${row.latestPost?.toISOString() ?? '-'}`,
      );
    }
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
