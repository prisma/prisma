import 'dotenv/config';
import { defineConfig } from '@prisma/cli-engine';
import postgis from '@prisma/orm-extension-postgis/control';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (load it from .env or your environment)');
}

export default defineConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    extensions: [postgis],
    db: { connection: databaseUrl },
  }),
});
