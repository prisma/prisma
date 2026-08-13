import { defineConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-mongo/config';

export default defineConfig({
  orm: ormConfig({
    contract: './contract.ts',
    output: './generated',
  }),
});
