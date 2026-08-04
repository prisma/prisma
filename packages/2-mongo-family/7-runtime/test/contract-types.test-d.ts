import type { InferModelRow } from '@internal/mongo-contract';
import { expectTypeOf, test } from 'vitest';
import type { Contract } from './fixtures/contract';

test('infers User row fields from contract', () => {
  type UserRow = InferModelRow<Contract, 'User'>;
  type Expected = {
    _id: string;
    name: string;
    email: string;
    bio: string | null;
    createdAt: Date;
  };

  expectTypeOf({} as UserRow).toEqualTypeOf({} as Expected);
});

test('infers Post row fields from contract', () => {
  type PostRow = InferModelRow<Contract, 'Post'>;
  type Expected = {
    _id: string;
    title: string;
    slug: string;
    content: string;
    status: string;
    authorId: string;
    viewCount: number;
    publishedAt: Date | null;
    updatedAt: Date;
  };

  expectTypeOf({} as PostRow).toEqualTypeOf({} as Expected);
});
