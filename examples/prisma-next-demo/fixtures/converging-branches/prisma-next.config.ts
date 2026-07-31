import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  db: {
    connection:
      'postgresql://converging-branches:converging-branches@localhost:5432/converging-branches',
  },
  migrations: {
    dir: './migrations',
  },
});
