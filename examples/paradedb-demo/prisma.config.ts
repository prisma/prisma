import 'dotenv/config';
import { defineConfig } from '@prisma/cli-engine';
import paradedb from '@prisma/orm-extension-paradedb/control';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  orm: ormConfig({
    contract: './prisma/contract.ts',
    output: './src/prisma',
    extensions: [paradedb],
    db: {
      // biome-ignore lint/style/noNonNullAssertion: loaded from .env
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
