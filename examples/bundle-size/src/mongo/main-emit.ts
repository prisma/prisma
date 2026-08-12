import { db } from './generated/db';

async function main(): Promise<void> {
  const url = process.env['MONGODB_URL'];
  const dbName = process.env['MONGODB_DB'] ?? 'bundle_size';
  if (!url) {
    throw new Error('MONGODB_URL is required');
  }
  const runtime = await db.connect({ url, dbName });
  try {
    const plan = db.query.from('notes').limit(10).build();
    const notes = await runtime.execute(plan).toArray();
    console.log(JSON.stringify(notes, null, 2));
  } finally {
    await db.close();
  }
}

await main();
