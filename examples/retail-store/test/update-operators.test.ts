import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { addToCart, getCartByUserId, removeFromCart, upsertCart } from '../src/data/carts';
import { createOrder, getOrderById, updateOrderStatus } from '../src/data/orders';
import { enums } from '../src/enums';
import { setupTestDb } from './setup';

describe('array update operators', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  const ctx = setupTestDb('update_operators_test');

  it('$push adds item to cart', async () => {
    const user = await ctx.db.orm.users.create({
      name: 'Alice',
      email: 'alice@example.com',
      address: null,
    });

    await upsertCart(ctx.db, user._id, [
      {
        productId: 'prod-1',
        name: 'Shirt',
        brand: 'Heritage',
        amount: 1,
        price: { amount: 79.99, currency: 'USD' },
        image: { url: '/shirt.jpg' },
      },
    ]);

    await addToCart(ctx.db, user._id, {
      productId: 'prod-2',
      name: 'Chinos',
      brand: 'UrbanEdge',
      amount: 1,
      price: { amount: 59.99, currency: 'USD' },
      image: { url: '/chinos.jpg' },
    });

    const cart = await getCartByUserId(ctx.db, user._id);
    expect(cart).not.toBeNull();
    expect(cart!.items).toHaveLength(2);
    const names = cart!.items.map((i) => i.name).sort();
    expect(names).toEqual(['Chinos', 'Shirt']);
  });

  it('$pull removes item from cart by productId', async () => {
    const user = await ctx.db.orm.users.create({
      name: 'Bob',
      email: 'bob@example.com',
      address: null,
    });

    await upsertCart(ctx.db, user._id, [
      {
        productId: 'prod-1',
        name: 'Shirt',
        brand: 'Heritage',
        amount: 1,
        price: { amount: 79.99, currency: 'USD' },
        image: { url: '/shirt.jpg' },
      },
      {
        productId: 'prod-2',
        name: 'Chinos',
        brand: 'UrbanEdge',
        amount: 2,
        price: { amount: 59.99, currency: 'USD' },
        image: { url: '/chinos.jpg' },
      },
    ]);

    await removeFromCart(ctx.db, user._id, 'prod-1');

    const cart = await getCartByUserId(ctx.db, user._id);
    expect(cart).not.toBeNull();
    expect(cart!.items).toHaveLength(1);
    expect(cart!.items[0]!.productId).toBe('prod-2');
  });

  it('$push adds status entry to order statusHistory', async () => {
    const user = await ctx.db.orm.users.create({
      name: 'Carol',
      email: 'carol@example.com',
      address: null,
    });

    const order = await createOrder(ctx.db, {
      userId: user._id,
      items: [
        {
          productId: 'prod-1',
          name: 'Item',
          brand: 'B',
          amount: 1,
          price: { amount: 100, currency: 'USD' },
          image: { url: '/item.jpg' },
        },
      ],
      shippingAddress: '123 St',
      type: enums.OrderType.members.Delivery,
      statusHistory: [{ status: 'placed', timestamp: new Date('2026-03-01T10:00:00Z') }],
    });

    await updateOrderStatus(ctx.db, order._id, {
      status: 'shipped',
      timestamp: new Date('2026-03-02T14:00:00Z'),
    });

    await updateOrderStatus(ctx.db, order._id, {
      status: 'delivered',
      timestamp: new Date('2026-03-04T09:00:00Z'),
    });

    const updated = await getOrderById(ctx.db, order._id);
    expect(updated).not.toBeNull();
    expect(updated!.statusHistory).toHaveLength(3);
    const statuses = updated!.statusHistory.map((s) => s.status);
    expect(statuses).toEqual(['placed', 'shipped', 'delivered']);
  });
});
