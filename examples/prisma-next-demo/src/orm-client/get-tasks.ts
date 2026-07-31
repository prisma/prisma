import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { createOrmClient } from './client';

export async function ormClientGetTasks(limit: number, runtime: Runtime) {
  const db = createOrmClient(runtime);
  return db.Task.take(limit).all();
}

export async function ormClientGetBugs(limit: number, runtime: Runtime) {
  const db = createOrmClient(runtime);
  return db.Task.bugs().take(limit).all();
}

export async function ormClientGetFeatures(limit: number, runtime: Runtime) {
  const db = createOrmClient(runtime);
  return db.Task.features().take(limit).all();
}
