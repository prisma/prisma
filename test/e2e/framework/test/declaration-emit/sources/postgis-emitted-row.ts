import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../../../../../examples/prisma-8-postgis-demo/src/prisma/contract.js';
import contractJson from '../../../../../../examples/prisma-8-postgis-demo/src/prisma/contract.json' with {
  type: 'json',
};

const db = postgres<Contract>({ contractJson, url: 'postgres://localhost/app' });

export const firstCafe = () => db.orm.public.Cafe.first();
