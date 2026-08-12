import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '../../../src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card';
import { Separator } from '../../../src/components/ui/separator';
import { getOrderWithUser } from '../../../src/data/orders';
import { getDb } from '../../../src/db';
import { getAuthUserId } from '../../../src/lib/auth';
import { OrderStatusButtons } from './order-status-buttons';

export const dynamic = 'force-dynamic';

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'destructive'> = {
  placed: 'default',
  shipped: 'warning',
  delivered: 'success',
  cancelled: 'destructive',
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) redirect('/login');

  const { id } = await params;
  const db = await getDb();
  const order = await getOrderWithUser(db, id);

  if (!order || order.userId !== userId) {
    notFound();
  }

  const total = order.items.reduce((sum, item) => sum + item.price.amount * item.amount, 0);
  const lastEntry = order.statusHistory[order.statusHistory.length - 1];
  const lastStatus = lastEntry ? lastEntry.status : 'placed';

  return (
    <div className="max-w-2xl">
      <Link
        href="/orders"
        className="text-sm text-muted hover:text-foreground mb-4 inline-block no-underline"
      >
        ← Back to orders
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Order Detail</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-muted mb-1">Shipping Address</p>
            <p>{order.shippingAddress}</p>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Items</h2>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted ml-2">×{item.amount}</span>
                  </div>
                  <span>${(item.price.amount * item.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="text-right font-bold text-lg mt-3">Total: ${total.toFixed(2)}</div>
          </div>

          <Separator />

          <div>
            <h2 className="font-semibold mb-3">Status History</h2>
            <div className="flex flex-col gap-2">
              {order.statusHistory.map((entry) => {
                const s = entry.status;
                return (
                  <div
                    key={`${s}-${entry.timestamp}`}
                    className="flex justify-between items-center"
                  >
                    <Badge variant={statusVariant[s] ?? 'outline'}>{s}</Badge>
                    <span className="text-sm text-muted">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <OrderStatusButtons orderId={id} currentStatus={lastStatus} />
        </CardContent>
      </Card>
    </div>
  );
}
