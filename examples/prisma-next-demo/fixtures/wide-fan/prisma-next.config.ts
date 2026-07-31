import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  db: {
    connection: 'postgresql://wide-fan:wide-fan@localhost:5432/wide-fan',
  },
  migrations: {
    dir: './migrations',
  },
});
