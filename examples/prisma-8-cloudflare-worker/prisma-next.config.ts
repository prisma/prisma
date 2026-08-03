import { defineConfig } from '@prisma/orm-postgres/config';
import { EXAMPLE_ROOT, loadLocalEnv } from './scripts/env';

loadLocalEnv(EXAMPLE_ROOT);

export default defineConfig({
  contract: './src/prisma/contract.prisma',
  db: {
    // biome-ignore lint/style/noNonNullAssertion: loaded from .env
    connection: process.env['DATABASE_URL']!,
  },
});
