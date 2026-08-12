import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import {
  aggregateEventsByType,
  createAddToCartEvent,
  createSearchEvent,
  createViewProductEvent,
} from '../src/data/events';
import { getRandomProducts } from '../src/data/products';
import { setupTestDb } from './setup';

describe('aggregation pipelines', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  const ctx = setupTestDb('aggregation_test');

  it('aggregates events by type for a user', async () => {
    for (let i = 0; i < 3; i++) {
      await createViewProductEvent(ctx.db, {
        userId: 'test-user',
        sessionId: `sess-view-${i}`,
        timestamp: new Date(),
        productId: `prod-${i}`,
        subCategory: 'Topwear',
        brand: 'TestBrand',
        exitMethod: null,
      });
    }
    for (let i = 0; i < 2; i++) {
      await createAddToCartEvent(ctx.db, {
        userId: 'test-user',
        sessionId: `sess-cart-${i}`,
        timestamp: new Date(),
        productId: `prod-${i}`,
        brand: 'TestBrand',
      });
    }
    await createSearchEvent(ctx.db, {
      userId: 'test-user',
      sessionId: 'sess-search-0',
      timestamp: new Date(),
      query: 'test query',
    });

    const result = await aggregateEventsByType(ctx.db, 'test-user');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ _id: 'view-product', count: 3 });
    expect(result[1]).toMatchObject({ _id: 'add-to-cart', count: 2 });
    expect(result[2]).toMatchObject({ _id: 'search', count: 1 });
  });

  it('samples random products', async () => {
    await ctx.db.orm.products.createAll(
      Array.from({ length: 10 }, (_, i) => ({
        name: `Product ${i}`,
        brand: 'TestBrand',
        code: `TB-${i}`,
        description: `Description ${i}`,
        primaryCategory: 'Apparel',
        subCategory: 'Topwear',
        articleType: 'Shirts',
        price: { amount: 10 + i, currency: 'USD' },
        image: { url: `/img${i}.jpg` },
        embedding: null,
        status: 'active',
      })),
    );

    const sample = await getRandomProducts(ctx.db, 3);
    expect(sample).toHaveLength(3);
    for (const product of sample) {
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
    }
  });
});
