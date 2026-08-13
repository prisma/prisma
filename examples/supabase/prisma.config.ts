import { defineConfig } from '@prisma/cli-engine';
import supabasePack from '@prisma/orm-extension-supabase/pack';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  orm: ormConfig({
    contract: './src/contract.prisma',
    extensions: [supabasePack],
    migrations: {
      dir: 'migrations',
    },
  }),
});
