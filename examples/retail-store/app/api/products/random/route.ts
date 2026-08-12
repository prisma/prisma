import { type NextRequest, NextResponse } from 'next/server';
import { getRandomProducts } from '../../../../src/data/products';
import { getDb } from '../../../../src/db';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('count');
  const count = raw === null ? 4 : Number.parseInt(raw, 10);
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    return NextResponse.json(
      { error: 'Invalid count. Expected an integer between 1 and 24.' },
      { status: 400 },
    );
  }
  const db = await getDb();
  const products = await getRandomProducts(db, count);
  return NextResponse.json(products);
}
