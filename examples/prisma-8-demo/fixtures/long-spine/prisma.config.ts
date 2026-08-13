import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.prisma',
    db: {
      connection: 'postgresql://long-spine:long-spine@localhost:5432/long-spine',
    },
    migrations: {
      dir: './migrations',
    },
  }),
});
