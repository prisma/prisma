import { defineConfig } from '@prisma/orm-postgres/config';

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

const databaseUrl = readRequiredEnv('DATABASE_URL');

export default defineConfig({
  contract: './src/prisma/contract.prisma',
  db: {
    connection: databaseUrl,
  },
});
