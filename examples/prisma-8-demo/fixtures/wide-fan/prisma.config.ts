import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.prisma',
    db: {
      connection: 'postgresql://wide-fan:wide-fan@localhost:5432/wide-fan',
    },
    migrations: {
      dir: './migrations',
    },
  }),
});
