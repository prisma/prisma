import paradedb from '@prisma/orm-extension-paradedb/runtime';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  extensions: [paradedb],
});
