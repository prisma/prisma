import { expect, it } from 'vitest';
import { contractInputDirectory } from '../src/contract-input-directory';

it.each([
  ['/schemas/**/*.prisma', '/schemas'],
  ['/schemas/{one/nested,two}/**/*.prisma', '/schemas'],
  ['/schemas/[[]id[]]/schema.prisma', '/schemas/[id]'],
  ['/schemas/\\[id\\]/schema.prisma', '/schemas/[id]'],
  ['/schemas/@(one|two)/schema.prisma', '/schemas'],
  ['/schemas/{literal}/schema.prisma', '/schemas/{literal}'],
  ['/schemas/[unfinished/schema.prisma', '/schemas/[unfinished'],
  ['/elsewhere/missing/**/*.prisma', '/elsewhere/missing'],
  ['/schemas/schema.prisma', '/schemas'],
  ['/schemas/../outside/schema.prisma', '/schemas/../outside'],
  ['/schemas/../outside/**/*.prisma', '/schemas/../outside'],
  ['/app/schemas/{../outside,inside}/*.prisma', '/app'],
  ['/app/schemas/*/../../*.prisma', '/app'],
  ['/app/schemas/**/../*.prisma', '/app'],
  ['/app/schemas/*/../*.prisma', '/app/schemas'],
  ['/app/schemas/**/nested/../../*.prisma', '/app'],
  ['/app/schemas/?/schema.prisma', '/app/schemas'],
  ['/app/schemas/user?/schema.prisma', '/app/schemas'],
  ['/app/schemas/{inside,../../outside}/*.prisma', '/'],
  ['../schemas/**/../../*.prisma', '../..'],
  ['!schemas/*.prisma', '!schemas'],
  ['#schemas/*.prisma', '#schemas'],
  ['schemas/prefix*.prisma', 'schemas'],
  ['../schemas/@(one|two)/*.prisma', '../schemas'],
  ['schema.prisma', '.'],
  ['*.prisma', '.'],
  ['./*.prisma', '.'],
  ['prefix{one/nested,two}/*.prisma', '.'],
  ['/**/*.prisma', '/'],
  ['C:/schemas/**/*.prisma', 'C:/schemas'],
  ['//server/share/schemas/**/*.prisma', '//server/share/schemas'],
])('derives the common input directory of %s', (input, directory) => {
  expect(contractInputDirectory(input)).toBe(directory);
});
