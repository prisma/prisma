import { defineConfig as ormConfig } from '@internal/sqlite/config';
import { defineConfig } from '@prisma/cli-engine';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.ts',
    output: 'generated',
  }),
});
