import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-sqlite/config';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.ts',
    output: './generated',
  }),
});
