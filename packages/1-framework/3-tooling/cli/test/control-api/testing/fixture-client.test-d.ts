import { describe, expectTypeOf, it } from 'vitest';
import type {
  createFixtureControlClient,
  FixtureControlClient,
} from '../../../src/control-api/testing/fixture-client';
import type { ControlClient } from '../../../src/control-api/types';

describe('FixtureControlClient conformance', () => {
  it('implements the full ControlClient surface with matching signatures', () => {
    expectTypeOf<FixtureControlClient>().toExtend<ControlClient>();
    expectTypeOf<ReturnType<typeof createFixtureControlClient>>().toExtend<ControlClient>();
  });

  it('exposes every ControlClient operation name', () => {
    expectTypeOf<keyof ControlClient>().toExtend<keyof FixtureControlClient>();
  });
});
