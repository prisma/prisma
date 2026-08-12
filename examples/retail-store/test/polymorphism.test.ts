import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import {
  createAddToCartEvent,
  createSearchEvent,
  createViewProductEvent,
  findEventsByUser,
  findSearchEventsByUser,
} from '../src/data/events';
import { setupTestDb } from './setup';

describe('polymorphic events', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  const ctx = setupTestDb('polymorphism_test');

  it('creates variant events with auto-injected discriminator', async () => {
    await createViewProductEvent(ctx.db, {
      userId: 'user-1',
      sessionId: 'sess-1',
      timestamp: new Date('2026-03-01'),
      productId: 'prod-1',
      subCategory: 'Topwear',
      brand: 'Heritage',
      exitMethod: null,
    });

    await createSearchEvent(ctx.db, {
      userId: 'user-1',
      sessionId: 'sess-1',
      timestamp: new Date('2026-03-01'),
      query: 'leather bag',
    });

    await createAddToCartEvent(ctx.db, {
      userId: 'user-1',
      sessionId: 'sess-1',
      timestamp: new Date('2026-03-01'),
      productId: 'prod-2',
      brand: 'Urban',
    });

    const events = await findEventsByUser(ctx.db, 'user-1');
    expect(events).toHaveLength(3);

    const types = events.map((e) => e.type);
    expect(types).toContain('view-product');
    expect(types).toContain('search');
    expect(types).toContain('add-to-cart');
  });

  it('queries base collection returns all variants', async () => {
    await createViewProductEvent(ctx.db, {
      userId: 'user-a',
      sessionId: 'sess-a',
      timestamp: new Date('2026-03-01'),
      productId: 'prod-1',
      subCategory: 'Topwear',
      brand: 'Heritage',
      exitMethod: 'scroll',
    });

    await createSearchEvent(ctx.db, {
      userId: 'user-a',
      sessionId: 'sess-a',
      timestamp: new Date('2026-03-02'),
      query: 'sneakers',
    });

    const events = await findEventsByUser(ctx.db, 'user-a');
    expect(events).toHaveLength(2);

    const viewEvent = events.find((e) => e.type === 'view-product');
    expect(viewEvent).toMatchObject({
      productId: 'prod-1',
      subCategory: 'Topwear',
      brand: 'Heritage',
      exitMethod: 'scroll',
    });

    const searchEvent = events.find((e) => e.type === 'search');
    expect(searchEvent).toMatchObject({ query: 'sneakers' });
  });

  it('variant query filters by discriminator', async () => {
    await createSearchEvent(ctx.db, {
      userId: 'user-b',
      sessionId: 'sess-b1',
      timestamp: new Date('2026-03-01'),
      query: 'bags',
    });

    await createSearchEvent(ctx.db, {
      userId: 'user-b',
      sessionId: 'sess-b2',
      timestamp: new Date('2026-03-02'),
      query: 'shoes',
    });

    await createViewProductEvent(ctx.db, {
      userId: 'user-b',
      sessionId: 'sess-b3',
      timestamp: new Date('2026-03-03'),
      productId: 'prod-5',
      subCategory: 'Footwear',
      brand: 'TrailCraft',
      exitMethod: null,
    });

    const searchEvents = await findSearchEventsByUser(ctx.db, 'user-b');
    expect(searchEvents).toHaveLength(2);
    for (const event of searchEvents) {
      expect(event.type).toBe('search');
      expect(event).toHaveProperty('query');
    }
  });

  it('variant fields are accessible on returned documents', async () => {
    await createViewProductEvent(ctx.db, {
      userId: 'user-c',
      sessionId: 'sess-c',
      timestamp: new Date('2026-04-01'),
      productId: 'prod-10',
      subCategory: 'Bags',
      brand: 'LuxLine',
      exitMethod: null,
    });

    const events = await findEventsByUser(ctx.db, 'user-c');
    expect(events).toHaveLength(1);
    const event = events[0]!;

    expect(event).toMatchObject({
      userId: 'user-c',
      sessionId: 'sess-c',
      type: 'view-product',
      productId: 'prod-10',
      subCategory: 'Bags',
      brand: 'LuxLine',
    });
    expect(event).toHaveProperty('exitMethod', null);
    expect(event).not.toHaveProperty('metadata');
  });
});
