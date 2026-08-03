import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { seed } from '../src/seed';
import { setupTestDb } from './setup';

describe('seed', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  const ctx = setupTestDb('seed_test');

  it('populates all 7 collections and data is queryable', async () => {
    await seed(ctx.db);

    const products = await ctx.db.orm.products.all();
    expect(products.length).toBeGreaterThanOrEqual(3);
    expect(products[0]!.price).toBeDefined();
    expect(products[0]!.image).toBeDefined();

    const users = await ctx.db.orm.users.all();
    expect(users.length).toBeGreaterThanOrEqual(2);
    const withAddress = users.find((u) => u.address !== null);
    expect(withAddress).toBeDefined();
    expect(withAddress!.address).toMatchObject({ city: 'San Francisco' });

    const carts = await ctx.db.orm.carts.all();
    expect(carts.length).toBeGreaterThanOrEqual(1);
    expect(carts[0]!.items.length).toBeGreaterThan(0);
    expect(carts[0]!.items[0]!.price).toBeDefined();

    const orders = await ctx.db.orm.orders.all();
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(orders[0]!.items.length).toBeGreaterThan(0);
    expect(orders[0]!.statusHistory.length).toBeGreaterThan(0);

    const locations = await ctx.db.orm.locations.all();
    expect(locations.length).toBeGreaterThanOrEqual(2);

    const invoices = await ctx.db.orm.invoices.all();
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0]!.items.length).toBeGreaterThan(0);

    const events = await ctx.db.orm.events.all();
    expect(events.length).toBeGreaterThanOrEqual(3);
    const types = events.map((e) => e.type);
    expect(types).toContain('view-product');
    expect(types).toContain('add-to-cart');
    expect(types).toContain('search');
  });
});
