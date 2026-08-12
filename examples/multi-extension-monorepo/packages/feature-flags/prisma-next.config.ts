/**
 * Prisma Next config for the internal `feature-flags` contract-space
 * package — see `../audit/prisma-next.config.ts` for the framing.
 */

import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './src/contract.prisma',
  migrations: { dir: 'migrations' },
});
