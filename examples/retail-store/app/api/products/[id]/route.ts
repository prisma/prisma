import { NextResponse } from 'next/server';
import { findProductById } from '../../../../src/data/products';
import { getDb } from '../../../../src/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const product = await findProductById(db, id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json(product);
}
