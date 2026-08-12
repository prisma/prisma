import postgres from '@prisma/orm-postgres/runtime';
import { contract } from './contract';

const db = postgres({ contract });

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const runtime = await db.connect({ url: databaseUrl });
  try {
    const notes = await runtime.execute(db.sql.public.Note.select('id').limit(10).build());
    console.log(JSON.stringify(notes, null, 2));
  } finally {
    await db.close();
  }
}

await main();
