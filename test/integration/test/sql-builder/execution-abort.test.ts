import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: runtime.execute({ signal }) — abort semantics', {
  timeout: timeouts.databaseOperation,
}, () => {
  const { db, runtime } = setupIntegrationTest();

  it('already-aborted signal at entry rejects on first iteration with RUNTIME.ABORTED { phase: stream }', async () => {
    const controller = new AbortController();
    const reason = new Error('user cancelled before execute');
    controller.abort(reason);

    const plan = db().public.users.select('id', 'name').build();

    await expect(
      runtime().execute(plan, { signal: controller.signal }).toArray(),
    ).rejects.toMatchObject({
      code: 'RUNTIME.ABORTED',
      details: { phase: 'stream' },
      cause: reason,
    });
  });

  it('mid-stream abort between rows exits with RUNTIME.ABORTED { phase: stream } and yields the rows received before the abort', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled mid-stream');
    const plan = db().public.users.select('id', 'name').orderBy('id').build();

    const collected: { id: number; name: string }[] = [];
    const consume = async (): Promise<void> => {
      const result = runtime().execute(plan, { signal: controller.signal });
      for await (const row of result) {
        collected.push(row);
        // After the first row, simulate a user-initiated cancellation.
        if (collected.length === 1) {
          controller.abort(reason);
        }
      }
    };

    await expect(consume()).rejects.toMatchObject({
      code: 'RUNTIME.ABORTED',
      details: { phase: 'stream' },
      cause: reason,
    });
    expect(collected.length).toBeGreaterThanOrEqual(1);
    expect(collected[0]?.id).toBe(1);
    expect(collected[0]?.name).toBe('Alice');
  });

  it('regression — omitting options is identical to today (stream completes)', async () => {
    const plan = db().public.users.select('id').orderBy('id').build();
    const rows = await runtime().execute(plan).toArray();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
});
