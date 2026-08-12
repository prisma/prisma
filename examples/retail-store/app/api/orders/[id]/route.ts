import { NextResponse } from 'next/server';
import {
  deleteOrder,
  getOrderById,
  getOrderWithUser,
  updateOrderStatus,
} from '../../../../src/data/orders';
import { getDb } from '../../../../src/db';
import { getAuthUserId } from '../../../../src/lib/auth';

const unauthorized = () => NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Order not found' }, { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = await getDb();
  const order = await getOrderWithUser(db, id);
  if (!order || order.userId !== userId) return notFound();
  return NextResponse.json(order);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = await getDb();
  const order = await getOrderById(db, id);
  if (!order || order.userId !== userId) return notFound();
  const deleted = await deleteOrder(db, id);
  return NextResponse.json(deleted);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  let body: { status: string };
  try {
    const raw = await req.json();
    if (typeof raw?.status !== 'string' || !raw.status) {
      return NextResponse.json({ error: 'Missing required field: status' }, { status: 400 });
    }
    body = raw;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const db = await getDb();
  const order = await getOrderById(db, id);
  if (!order || order.userId !== userId) return notFound();
  await updateOrderStatus(db, id, {
    status: body.status,
    timestamp: new Date(),
  });
  const updated = await getOrderWithUser(db, id);
  return NextResponse.json(updated);
}
