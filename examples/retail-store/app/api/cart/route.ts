import { NextResponse } from 'next/server';
import { addToCart, clearCart, getCartByUserId, removeFromCart } from '../../../src/data/carts';
import { getDb } from '../../../src/db';
import { getAuthUserId } from '../../../src/lib/auth';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ items: [] }, { status: 401 });
  const db = await getDb();
  const cart = await getCartByUserId(db, userId);
  return NextResponse.json(cart ?? { items: [] });
}

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await req.json();
  if (!body.productId || !body.name || !body.brand || !body.amount || !body.price || !body.image) {
    return NextResponse.json(
      { error: 'Missing required fields: productId, name, brand, amount, price, image' },
      { status: 400 },
    );
  }
  const db = await getDb();

  await addToCart(db, userId, body);

  const cart = await getCartByUserId(db, userId);
  return NextResponse.json(cart ?? { items: [] });
}

export async function DELETE(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ items: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const db = await getDb();

  if (productId) {
    await removeFromCart(db, userId, productId);
  } else {
    await clearCart(db, userId);
  }

  const cart = await getCartByUserId(db, userId);
  return NextResponse.json(cart ?? { items: [] });
}
