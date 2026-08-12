import { NextResponse } from 'next/server';
import { clearCart } from '../../../src/data/carts';
import { createOrder, getUserOrders } from '../../../src/data/orders';
import { getDb } from '../../../src/db';
import { enums } from '../../../src/enums';
import { getAuthUserId } from '../../../src/lib/auth';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json([], { status: 401 });
  const db = await getDb();
  const orders = await getUserOrders(db, userId);
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await req.json();
  if (!Array.isArray(body.items) || body.items.length === 0 || !body.shippingAddress) {
    return NextResponse.json(
      { error: 'Missing required fields: items, shippingAddress' },
      { status: 400 },
    );
  }
  const db = await getDb();
  const order = await createOrder(db, {
    userId,
    items: body.items,
    shippingAddress: body.shippingAddress,
    type: body.type ?? enums.OrderType.members.Delivery,
    statusHistory: [{ status: 'placed', timestamp: new Date() }],
  });
  await clearCart(db, userId);
  return NextResponse.json(order, { status: 201 });
}
