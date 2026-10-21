import { describe, expectTypeOf, it } from 'vitest';
import type {
  AuthoringArgumentDescriptor,
  AuthoringValueArgument,
} from '../src/shared/framework-authoring';

describe('AuthoringValueArgument', () => {
  it('is a whole argument descriptor, with its name and whether it is optional', () => {
    const length = {
      kind: 'value',
      dataType: 'pg/int4',
      name: 'length',
      optional: true,
    } as const;
    expectTypeOf(length).toExtend<AuthoringValueArgument>();
    expectTypeOf<AuthoringValueArgument>().toExtend<AuthoringArgumentDescriptor>();
  });

  it('holds only value arguments', () => {
    expectTypeOf<{ readonly kind: 'number' }>().not.toExtend<AuthoringValueArgument>();
  });
});
