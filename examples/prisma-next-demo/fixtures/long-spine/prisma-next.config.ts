import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  db: {
    connection: 'postgresql://long-spine:long-spine@localhost:5432/long-spine',
  },
  migrations: {
    dir: './migrations',
  },
});
