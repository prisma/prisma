import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  db: {
    connection: 'postgresql://multi-branch:multi-branch@localhost:5432/multi-branch',
  },
  migrations: {
    dir: './migrations',
  },
});
