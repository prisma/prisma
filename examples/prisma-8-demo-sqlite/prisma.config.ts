import 'dotenv/config';
import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-sqlite/config';

export default defineConfig({
  orm: ormConfig({
    contract: './prisma/contract.ts',
    output: './src/prisma',
    db: {
      connection: process.env['SQLITE_PATH'] ?? './demo.db',
    },
  }),
});
