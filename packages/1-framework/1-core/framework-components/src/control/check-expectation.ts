import { type } from 'arktype';
import type { CheckExpectation } from './control-migration-types';

export function expectAbsent(object: string): CheckExpectation {
  return { expects: 'absent', object };
}

export function expectPresent(object: string): CheckExpectation {
  return { expects: 'present', object };
}

/** The shape a check's expectation must have where it is read from an `ops.json`. */
export const CheckExpectationSchema = type({
  expects: "'absent' | 'present'",
  object: 'string > 0',
});
