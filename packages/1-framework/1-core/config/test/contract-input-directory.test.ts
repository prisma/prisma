import { expect, it } from 'vitest';
import { contractInputDirectory } from '../src/contract-input-directory';

it.each([
  ['/schemas/**/*.prisma', '/schemas', true],
  ['/schemas/{one/nested,two}/**/*.prisma', '/schemas', true],
  ['/schemas/[[]id[]]/schema.prisma', '/schemas', true],
  ['/schemas/\\[id\\]/schema.prisma', '/schemas', true],
  ['/schemas/@(one|two)/schema.prisma', '/schemas', true],
  ['/schemas/{literal}/schema.prisma', '/schemas', true],
  ['/schemas/[unfinished/schema.prisma', '/schemas', true],
  ['/elsewhere/missing/**/*.prisma', '/elsewhere/missing', true],
  ['/schemas/schema.prisma', '/schemas', false],
  ['/schemas/../outside/schema.prisma', '/schemas/../outside', false],
  ['*.prisma', '', true],
  ['/**/*.prisma', '/', true],
])('derives the conservative directory of %s', (input, directory, hasPatternBoundary) => {
  expect(contractInputDirectory(input)).toEqual({ directory, hasPatternBoundary });
});
