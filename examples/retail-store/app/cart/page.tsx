import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '../../src/components/ui/button';
import { Card, CardContent } from '../../src/components/ui/card';
import { Separator } from '../../src/components/ui/separator';
import { getCartByUserId } from '../../src/data/carts';
import { getDb } from '../../src/db';
import { getAuthUserId } from '../../src/lib/auth';
import { CartActions } from './cart-actions';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect('/login');

  const db = await getDb();
  const cart = await getCartByUserId(db, userId);
  const items = cart?.items ?? [];

  const total = items.reduce((sum, item) => sum + item.price.amount * item.amount, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted mb-4">Your cart is empty.</p>
          <Button asChild>
            <Link href="/">Browse Products</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <Card key={item.productId}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted">
                      {item.brand} · Qty: {item.amount}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${(item.price.amount * item.amount).toFixed(2)}
                    </span>
                    <CartActions productId={item.productId} mode="remove" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <div className="flex gap-3 mt-6">
            <CartActions mode="clear" />
            <Button asChild>
              <Link href="/checkout">Proceed to Checkout</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
