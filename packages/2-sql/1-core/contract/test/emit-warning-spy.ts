import { afterAll, afterEach, beforeAll, type MockInstance, vi } from 'vitest';

/**
 * Spies `process.emitWarning` for one suite. The spy is installed in `beforeAll` rather than at
 * collection time because suites in one run share the global: stacked collection-time spies let
 * one suite's restore discard the next suite's instrumentation.
 */
export function useEmitWarningSpy(): () => MockInstance<typeof process.emitWarning> {
  let spy: MockInstance<typeof process.emitWarning>;
  beforeAll(() => {
    spy = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockClear();
  });
  afterAll(() => {
    spy.mockRestore();
  });
  return () => spy;
}
