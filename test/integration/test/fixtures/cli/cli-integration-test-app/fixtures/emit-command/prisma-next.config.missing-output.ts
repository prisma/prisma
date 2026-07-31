import postgresAdapter from '@internal/adapter-postgres/control';
import postgresDriver from '@internal/driver-postgres/control';
import sql from '@internal/family-sql/control';
import { typescriptContract } from '@internal/sql-contract-ts/config-types';
import postgres from '@internal/target-postgres/control';
import { contract } from './contract';

// Manually create config without using defineConfig to verify loader finalization.
export default {
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensions: [],
  // Omit output intentionally; loadConfig should finalize it to src/prisma/contract.json.
  contract: typescriptContract(contract),
};
