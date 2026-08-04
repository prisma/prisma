import sqlite from '@prisma/orm-sqlite/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };

export const db = sqlite<Contract>({
  contractJson,
});
