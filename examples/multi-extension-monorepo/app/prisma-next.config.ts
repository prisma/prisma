/**
 * Aggregate root config for the multi-extension-monorepo example.
 *
 * Composes the application's own contract with two internal extension
 * packages (`audit` and `feature-flags`). This is the config an
 * application author writes — the CLI reads it for `contract emit`,
 * `migration plan`, `db init`, and `db update`.
 */

import { defineConfig } from '@prisma/orm-postgres/config';
import audit from '../packages/audit/src/control';
import featureFlags from '../packages/feature-flags/src/control';

export default defineConfig({
  contract: './src/contract.prisma',
  extensions: [audit, featureFlags],
  migrations: { dir: 'migrations' },
});
