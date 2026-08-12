import 'dotenv/config';
import pg from 'pg';

async function dropDatabase() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop the public schema and recreate it (removes all tables)
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    console.log('✔ Dropped and recreated public schema');

    // Also drop the prisma_contract schema if it exists
    await client.query('DROP SCHEMA IF EXISTS prisma_contract CASCADE');
    console.log('✔ Dropped prisma_contract schema');

    console.log('\nDatabase reset complete');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

dropDatabase();
