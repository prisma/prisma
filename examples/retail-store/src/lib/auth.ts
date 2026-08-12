import { cookies } from 'next/headers';
import { findUserById } from '../data/users';
import { getDb } from '../db';

export async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('userId')?.value ?? null;
}

export async function getAuthUser() {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const db = await getDb();
  return findUserById(db, userId);
}
