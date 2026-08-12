import { SELF } from 'cloudflare:test';
import { describe, expect, inject, it } from 'vitest';

const ALICE = inject('alice-id');
const BOB = inject('bob-id');

async function get(path: string): Promise<Response> {
  return await SELF.fetch(new Request(`https://worker.local${path}`));
}

describe('worker — postgresServerless against Hyperdrive (local)', () => {
  it('boots and responds to /health (TC-3 — module load under nodejs_compat)', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('SQL DSL select returns seeded users (TC-4)', async () => {
    const res = await get('/sql/users?limit=5');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; rows: { id: string; email: string }[] };
    expect(body.ok).toBe(true);
    expect(body.rows.length).toBe(2);
    expect(body.rows.map((r) => r.email).sort()).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('ORM client list returns seeded users (TC-5)', async () => {
    const res = await get('/orm/users?limit=10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; rows: { id: string; email: string }[] };
    expect(body.ok).toBe(true);
    expect(body.rows.length).toBe(2);
  });

  it('ORM relation traversal returns posts for a user', async () => {
    const res = await get(`/orm/posts?userId=${ALICE}&limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; rows: { userId: string }[] };
    expect(body.ok).toBe(true);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows.every((row) => row.userId === ALICE)).toBe(true);
  });

  it('withTransaction commits a multi-statement transaction (TC-6, AC-10)', async () => {
    const res = await get(`/tx/commit?userId=${BOB}&displayName=Bob+the+Builder`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; committed?: boolean };
    expect(body.ok).toBe(true);
    expect(body.committed).toBe(true);

    const verify = await get('/sql/users?limit=10');
    const verified = (await verify.json()) as {
      rows: { id: string; displayName: string }[];
    };
    const bob = verified.rows.find((r) => r.id === BOB);
    expect(bob?.displayName).toBe('Bob the Builder');
  });

  it('withTransaction rolls back on thrown error (AC-10/AC-11)', async () => {
    const before = (await (await get('/sql/users?limit=10')).json()) as {
      rows: { email: string; displayName: string }[];
    };
    const aliceBefore = before.rows.find((r) => r.email === 'alice@example.com');

    const res = await get('/tx/rollback');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(true);
    expect(body.message).toContain('intentional rollback');

    const after = (await (await get('/sql/users?limit=10')).json()) as {
      rows: { email: string; displayName: string }[];
    };
    const aliceAfter = after.rows.find((r) => r.email === 'alice@example.com');
    expect(aliceAfter?.displayName).toBe(aliceBefore?.displayName);
    expect(aliceAfter?.displayName).not.toBe('rolled-back-write');
  });

  it('cursor early-break consumes only the requested rows (TC-9, AC-6)', async () => {
    const breakAfter = 7;
    const res = await get(`/cursor/large?break=${breakAfter}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      consumed: number;
      cancelled: boolean;
      elapsedMs: number;
      rowsTransmitted: number;
    };
    expect(body.ok).toBe(true);
    // global-setup seeds 10_000 posts. `consumed === breakAfter` proves the
    // for-await loop exited via `break`, not via the iterator running out.
    expect(body.consumed).toBe(breakAfter);
    expect(body.cancelled).toBe(true);
    // The behavioral assertion that demonstrably fails when cursor is
    // disabled: pg_stat_statements (queried by the route via a side-channel
    // pg.Client) reports how many rows the server actually transmitted.
    // With cursor enabled, only the first ~100-row batch is fetched before
    // the early `break` closes the cursor. With cursor disabled, the driver
    // buffers all 10_000 rows. Threshold of 500 leaves headroom for the
    // default 100-row batch size + one round of refill jitter, while still
    // failing decisively at 10_000.
    expect(body.rowsTransmitted).toBeGreaterThan(0);
    expect(body.rowsTransmitted).toBeLessThan(500);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await get('/no/such/route');
    expect(res.status).toBe(404);
  });
});
