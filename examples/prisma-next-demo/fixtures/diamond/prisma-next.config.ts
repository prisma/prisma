import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  db: {
    connection: 'postgresql://diamond:diamond@localhost:5432/diamond',
  },
  migrations: {
    dir: './migrations',
  },
});
