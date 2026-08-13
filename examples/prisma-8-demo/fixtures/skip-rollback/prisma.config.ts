import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.prisma',
    db: {
      connection: 'postgresql://skip-rollback:skip-rollback@localhost:5432/skip-rollback',
    },
    migrations: {
      dir: './migrations',
    },
  }),
});
