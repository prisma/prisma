import { type } from 'arktype';
import type { CheckExpectation } from './control-migration-types';

export function expectAbsent(object: string): CheckExpectation {
  return { expects: 'absent', object };
}

export function expectPresent(object: string): CheckExpectation {
  return { expects: 'present', object };
}

const CheckExpectationSchema = type({
  expects: "'absent' | 'present'",
  object: 'string > 0',
});

/** A check's expectation as read from an `ops.json`: the value when it has the shape, otherwise `undefined`. */
export function checkExpectationOf(value: unknown): CheckExpectation | undefined {
  const result = CheckExpectationSchema(value);
  return result instanceof type.errors ? undefined : result;
}
