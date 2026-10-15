import { expect, it } from 'vitest';
import { contractInputDirectory } from '../src/contract-input-directory';

it.each([
  ['/schemas/**/*.prisma', '/schemas'],
  ['/schemas/{one/nested,two}/**/*.prisma', '/schemas'],
  ['/schemas/[[]id[]]/schema.prisma', '/schemas'],
  ['/schemas/\\[id\\]/schema.prisma', '/schemas/[id]'],
  ['/schemas/@(one|two)/schema.prisma', '/schemas'],
  ['/schemas/{literal}/schema.prisma', '/schemas'],
  ['/schemas/[unfinished/schema.prisma', '/schemas'],
  ['/elsewhere/missing/**/*.prisma', '/elsewhere/missing'],
  ['/schemas/schema.prisma', '/schemas'],
  ['/schemas/../outside/schema.prisma', '/schemas/../outside'],
  ['/schemas/../outside/**/*.prisma', '/schemas/../outside'],
  ['/schemas/{../outside,inside}/*.prisma', '/schemas'],
  ['/schemas/*/../../*.prisma', '/schemas'],
  ['schemas/prefix*.prisma', 'schemas'],
  ['../schemas/@(one|two)/*.prisma', '../schemas'],
  ['schema.prisma', '.'],
  ['*.prisma', '.'],
  ['./*.prisma', '.'],
  ['prefix{one/nested,two}/*.prisma', '.'],
  ['/**/*.prisma', '/'],
  ['C:/schemas/**/*.prisma', 'C:/schemas'],
  ['//server/share/schemas/**/*.prisma', '//server/share/schemas'],
])('derives the glob-parent directory of %s', (input, directory) => {
  expect(contractInputDirectory(input)).toBe(directory);
});
