import { NextResponse } from 'next/server';
import { getCartByUserId } from '../../../../src/data/carts';
import { getDb } from '../../../../src/db';
import { getAuthUserId } from '../../../../src/lib/auth';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ count: 0 });
  const db = await getDb();
  const cart = await getCartByUserId(db, userId);
  const count = cart?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  return NextResponse.json({ count });
}
