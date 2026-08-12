import type { PlanMeta } from '@internal/contract/types';
import {
  type ExecutionPlan,
  type RuntimeMiddlewareContext,
  runExecuteWithMiddleware,
} from '@internal/framework-components/runtime';
import { expect, it, vi } from 'vitest';
import { createCacheMiddleware } from '../src/cache-middleware';

const meta: PlanMeta = {
  target: 'mock',
  storageHash: 'test',
  lane: 'raw-sql',
};

it('does not intercept or observe statistics execution', async () => {
  const middleware = createCacheMiddleware();
  const driver = vi.fn(async () => ({ affectedRows: 3 }));
  const ctx: RuntimeMiddlewareContext = {
    contract: {},
    mode: 'strict',
    now: Date.now,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    contentHash: async () => 'hash',
    scope: 'runtime',
    planExecutionId: 'execute-cache-bypass',
  };
  const plan: ExecutionPlan = { meta };

  await expect(runExecuteWithMiddleware(plan, [middleware], ctx, driver)).resolves.toEqual({
    affectedRows: 3,
  });
  expect(driver).toHaveBeenCalledOnce();
  expect(middleware).not.toHaveProperty('interceptExecute');
  expect(middleware).not.toHaveProperty('afterExecute');
});
