import type {
  PslNamedTypeDeclaration,
  PslTypeConstructorCall,
} from '@internal/framework-components/psl-ast';
import { expectTypeOf, test } from 'vitest';

const malformedDeclaration: PslNamedTypeDeclaration = {
  kind: 'namedType',
  name: 'Broken',
  attributes: [],
  span: {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 7, offset: 6 },
  },
};

test('named type declarations leave the parser invariant to downstream runtime guards', () => {
  expectTypeOf(malformedDeclaration.baseType).toEqualTypeOf<string | undefined>();
  expectTypeOf(malformedDeclaration.typeConstructor).toEqualTypeOf<
    PslTypeConstructorCall | undefined
  >();
});
