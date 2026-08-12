import { NextResponse } from 'next/server';
import { findProducts } from '../../../src/data/products';
import { getDb } from '../../../src/db';

export async function GET() {
  const db = await getDb();
  const products = await findProducts(db);
  return NextResponse.json(products);
}
