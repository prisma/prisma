import supabasePack from '@prisma-next/extension-supabase/pack';
import { defineConfig } from '@prisma-next/postgres/config';

export default defineConfig({
  contract: './src/contract.prisma',
  extensions: [supabasePack],
  migrations: {
    dir: 'migrations',
  },
});
