import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './prisma/contract';
import contractJson from './prisma/contract.json' with { type: 'json' };

export type TelemetryDb = ReturnType<typeof postgres<Contract>>;

export function createTelemetryDb(url: string): TelemetryDb {
  return postgres<Contract>({ contractJson, url });
}
