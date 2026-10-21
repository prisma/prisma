import type { CheckExpectation } from '@internal/framework-components/control';

export function expectAbsent(object: string): CheckExpectation {
  return { expects: 'absent', object };
}

export function expectPresent(object: string): CheckExpectation {
  return { expects: 'present', object };
}
