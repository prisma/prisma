import 'dotenv/config';
import postgis from '@prisma/orm-extension-postgis/control';
import { defineConfig } from '@prisma/orm-postgres/config';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (load it from .env or your environment)');
}

export default defineConfig({
  contract: './src/prisma/contract.prisma',
  extensions: [postgis],
  db: { connection: databaseUrl },
});
