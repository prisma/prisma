import 'dotenv/config';
import pgvector from '@prisma-next/extension-pgvector/control';
import { defineConfig } from '@prisma-next/postgres/config';

export default defineConfig({
  contract: './prisma/contract.ts',
  output: './src/prisma',
  extensions: [pgvector],
  db: {
    // biome-ignore lint/style/noNonNullAssertion: loaded from .env
    connection: process.env['DATABASE_URL']!,
  },
});
