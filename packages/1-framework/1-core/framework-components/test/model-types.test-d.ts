import { describe, expectTypeOf, test } from 'vitest';
import type { RelationKeys, Scalars, With } from '../src/execution/model-types';

type Post = {
  id: number;
  title: string;
  authorId: number;
  author: User;
  readonly [RelationKeys]?: 'author';
};

type Profile = {
  id: number;
  bio: string | null;
  readonly [RelationKeys]?: never;
};

type User = {
  id: number;
  name: string;
  posts: Post[];
  profile: Profile | null;
  manager: User;
  readonly [RelationKeys]?: 'posts' | 'profile' | 'manager';
};

type Bug = {
  id: number;
  type: 'bug';
  severity: string;
  reporter: User;
  readonly [RelationKeys]?: 'reporter';
};

type Feature = {
  id: number;
  type: 'feature';
  priority: number;
  readonly [RelationKeys]?: never;
};

type AnyTask = Bug | Feature;

describe('Scalars', () => {
  test('strips relation keys and the phantom', () => {
    expectTypeOf<Scalars<User>>().toEqualTypeOf<{ id: number; name: string }>();
  });

  test('keeps every field when the model has no relations', () => {
    expectTypeOf<Scalars<Profile>>().toEqualTypeOf<{ id: number; bio: string | null }>();
  });

  test('distributes over a union', () => {
    expectTypeOf<Scalars<AnyTask>>().toEqualTypeOf<
      | { id: number; type: 'bug'; severity: string }
      | { id: number; type: 'feature'; priority: number }
    >();
  });

  test('passes a type without the phantom through unchanged', () => {
    expectTypeOf<Scalars<{ id: number }>>().toEqualTypeOf<{ id: number }>();
  });
});

describe('With', () => {
  test('adds a to-many relation as Scalars of the related type in an array', () => {
    expectTypeOf<With<User, 'posts'>['posts']>().toEqualTypeOf<
      { id: number; title: string; authorId: number }[]
    >();
    expectTypeOf<With<User, 'posts'>>().toMatchTypeOf<{ id: number; name: string }>();
  });

  test('adds a nullable to-one relation as Scalars | null', () => {
    expectTypeOf<With<User, 'profile'>['profile']>().toEqualTypeOf<{
      id: number;
      bio: string | null;
    } | null>();
  });

  test('adds a non-nullable to-one relation as Scalars of the related type', () => {
    expectTypeOf<With<User, 'manager'>['manager']>().toEqualTypeOf<{
      id: number;
      name: string;
    }>();
  });

  test('accepts several relation names at once', () => {
    type View = With<User, 'posts' | 'profile'>;
    expectTypeOf<View>().toHaveProperty('posts');
    expectTypeOf<View>().toHaveProperty('profile');
    expectTypeOf<View>().not.toHaveProperty('manager');
  });

  test('does not carry the phantom', () => {
    expectTypeOf<keyof With<User, 'posts'>>().toEqualTypeOf<'id' | 'name' | 'posts'>();
  });

  test('rejects a key that is not a relation', () => {
    // @ts-expect-error - 'name' is a scalar field, not a relation
    type _Bad = With<User, 'name'>;
    // @ts-expect-error - 'nope' is not a key at all
    type _Missing = With<User, 'nope'>;
  });
});
