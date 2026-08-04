import supabasePack from '@prisma/orm-extension-supabase/pack';
import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './src/contract.prisma',
  extensions: [supabasePack],
  migrations: {
    dir: 'migrations',
  },
});
