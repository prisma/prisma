import { expect, it } from 'vitest';
import { contractInputDirectory } from '../src/contract-input-directory';

it.each([
  ['/schemas/**/*.prisma', '/schemas', '**/*.prisma'],
  ['/schemas/{one/nested,two}/**/*.prisma', '/schemas', '{one/nested,two}/**/*.prisma'],
  ['/schemas/[[]id[]]/schema.prisma', '/schemas', '[[]id[]]/schema.prisma'],
  ['/schemas/\\[id\\]/schema.prisma', '/schemas', '\\[id\\]/schema.prisma'],
  ['/schemas/@(one|two)/schema.prisma', '/schemas', '(one|two)/schema.prisma'],
  ['/schemas/{literal}/schema.prisma', '/schemas', '{literal}/schema.prisma'],
  ['/schemas/[unfinished/schema.prisma', '/schemas', '[unfinished/schema.prisma'],
  ['/elsewhere/missing/**/*.prisma', '/elsewhere/missing', '**/*.prisma'],
  ['/schemas/schema.prisma', '/schemas', undefined],
  ['/schemas/../outside/schema.prisma', '/schemas/../outside', undefined],
  ['/schemas/../outside/**/*.prisma', '/schemas/../outside', '**/*.prisma'],
  ['/schemas/{../outside,inside}/*.prisma', '/schemas', '{../outside,inside}/*.prisma'],
  ['schemas/prefix*.prisma', 'schemas', '*.prisma'],
  ['../schemas/@(one|two)/*.prisma', '../schemas', '(one|two)/*.prisma'],
  ['schema.prisma', '.', undefined],
  ['*.prisma', '', '*.prisma'],
  ['./*.prisma', '.', '*.prisma'],
  ['prefix{one/nested,two}/*.prisma', '', '{one/nested,two}/*.prisma'],
  ['/**/*.prisma', '/', '**/*.prisma'],
])('derives the conservative directory of %s', (input, directory, patternSuffix) => {
  expect(contractInputDirectory(input)).toEqual({ directory, patternSuffix });
});
