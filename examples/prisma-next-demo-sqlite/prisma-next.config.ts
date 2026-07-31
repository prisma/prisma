import 'dotenv/config';
import { defineConfig } from '@prisma/orm-sqlite/config';

export default defineConfig({
  contract: './prisma/contract.ts',
  output: './src/prisma',
  db: {
    connection: process.env['SQLITE_PATH'] ?? './demo.db',
  },
});
