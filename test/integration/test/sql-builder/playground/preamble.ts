import type { Db } from '@internal/sql-builder';
import type { Contract } from '../fixtures/generated/contract';

declare const db: Db<Contract>;

export { db };
