import { describe, expectTypeOf, test } from 'vitest';
import type { RelationKeys, Scalars, Shape, ShapeSpec } from '../src/execution/model-types';

type Post = {
  id: number;
  title: string;
  authorId: number;
  author: User;
  comments: Comment[];
  readonly [RelationKeys]?: 'author' | 'comments';
};

type Comment = {
  id: number;
  body: string;
  post: Post;
  readonly [RelationKeys]?: 'post';
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
  assignee: User | null;
  readonly [RelationKeys]?: 'reporter' | 'assignee';
};

type Feature = {
  id: number;
  type: 'feature';
  priority: number;
  owner: User;
  readonly [RelationKeys]?: 'owner';
};

type Chore = {
  id: number;
  type: 'chore';
  readonly [RelationKeys]?: never;
};

type AnyTask = Bug | Feature | Chore;

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
      | { id: number; type: 'chore' }
    >();
  });

  test('passes a type without the phantom through unchanged', () => {
    expectTypeOf<Scalars<{ id: number }>>().toEqualTypeOf<{ id: number }>();
  });
});

describe('Shape', () => {
  type UserRow = { id: number; name: string };
  type PostRow = { id: number; title: string; authorId: number };

  test('the empty spec is Scalars: every scalar, no relations', () => {
    expectTypeOf<Shape<User, Record<never, never>>>().not.toBeAny();
    expectTypeOf<Shape<User, Record<never, never>>>().toEqualTypeOf<Scalars<User>>();
    expectTypeOf<Shape<User, Record<never, never>>>().toEqualTypeOf<UserRow>();
    expectTypeOf<Shape<User>>().toEqualTypeOf<Scalars<User>>();
    expectTypeOf<Shape<Profile>>().toEqualTypeOf<Scalars<Profile>>();
    expectTypeOf<Shape<Profile, Record<never, never>>>().toEqualTypeOf<{
      id: number;
      bio: string | null;
    }>();
  });

  test('a relation key includes the relation with all of its scalars and none of its relations', () => {
    expectTypeOf<Shape<User, { posts: Record<never, never> }>>().toEqualTypeOf<{
      id: number;
      name: string;
      posts: PostRow[];
    }>();
    expectTypeOf<
      Shape<User, { posts: Record<never, never> }>['posts'][number]
    >().not.toHaveProperty('author');
  });

  test('cardinality and nullability come from the model field', () => {
    expectTypeOf<Shape<User, { posts: Record<never, never> }>['posts']>().toEqualTypeOf<
      PostRow[]
    >();
    expectTypeOf<Shape<User, { profile: Record<never, never> }>['profile']>().toEqualTypeOf<{
      id: number;
      bio: string | null;
    } | null>();
    expectTypeOf<
      Shape<User, { manager: Record<never, never> }>['manager']
    >().toEqualTypeOf<UserRow>();
  });

  test('a self relation is one level of the same model', () => {
    expectTypeOf<Shape<User, { manager: { manager: Record<never, never> } }>>().toEqualTypeOf<{
      id: number;
      name: string;
      manager: { id: number; name: string; manager: UserRow };
    }>();
  });

  test("'+' keeps only the named scalars", () => {
    expectTypeOf<Shape<User, { '+': 'id' }>>().toEqualTypeOf<{ id: number }>();
    expectTypeOf<Shape<Post, { '+': 'id' | 'title' }>>().toEqualTypeOf<{
      id: number;
      title: string;
    }>();
  });

  test("a relation named in '+' is included with all of its scalars and none of its relations", () => {
    expectTypeOf<Shape<User, { '+': 'id' | 'name' | 'posts' }>>().toEqualTypeOf<{
      id: number;
      name: string;
      posts: PostRow[];
    }>();
    expectTypeOf<Shape<User, { '+': 'posts' }>>().toEqualTypeOf<{ posts: PostRow[] }>();
    expectTypeOf<Shape<User, { '+': 'profile' }>['profile']>().toEqualTypeOf<{
      id: number;
      bio: string | null;
    } | null>();
  });

  test("'-' drops the named scalars and keeps every other scalar", () => {
    expectTypeOf<Shape<Post, { '-': 'authorId' }>>().toEqualTypeOf<{ id: number; title: string }>();
    expectTypeOf<Shape<Post, { '-': 'authorId' | 'title' }>>().toEqualTypeOf<{ id: number }>();
  });

  test("'-' with a relation key keeps the relation", () => {
    expectTypeOf<Shape<User, { '-': 'name'; posts: Record<never, never> }>>().toEqualTypeOf<{
      id: number;
      posts: PostRow[];
    }>();
  });

  test("'+' with a relation key keeps the named scalars and the relation", () => {
    expectTypeOf<Shape<User, { '+': 'id'; posts: Record<never, never> }>>().toEqualTypeOf<{
      id: number;
      posts: PostRow[];
    }>();
  });

  test('a nested spec applies to the related model', () => {
    expectTypeOf<
      Shape<User, { posts: { '+': 'title'; comments: Record<never, never> } }>
    >().toEqualTypeOf<{
      id: number;
      name: string;
      posts: { title: string; comments: { id: number; body: string }[] }[];
    }>();
    expectTypeOf<
      Shape<User, { posts: { '-': 'authorId'; author: { '+': 'name' } } }>
    >().toEqualTypeOf<{
      id: number;
      name: string;
      posts: { id: number; title: string; author: { name: string } }[];
    }>();
  });

  test('relations are absent unless asked for', () => {
    expectTypeOf<keyof Shape<User, Record<never, never>>>().toEqualTypeOf<'id' | 'name'>();
    expectTypeOf<keyof Shape<User, { posts: Record<never, never> }>>().toEqualTypeOf<
      'id' | 'name' | 'posts'
    >();
    expectTypeOf<keyof Shape<User, { '-': 'name' }>>().toEqualTypeOf<'id'>();
  });

  test('hover text is one flat object, not an intersection', () => {
    type Flat = { id: number; name: string; posts: PostRow[] };
    expectTypeOf<Shape<User, { posts: Record<never, never> }>>().toEqualTypeOf<{
      [K in keyof Flat]: Flat[K];
    }>();
  });

  test('distributes over a union so each variant keeps only its own relations', () => {
    expectTypeOf<Shape<AnyTask, { reporter: Record<never, never> }>>().toEqualTypeOf<
      | { id: number; type: 'bug'; severity: string; reporter: UserRow }
      | { id: number; type: 'feature'; priority: number }
      | { id: number; type: 'chore' }
    >();
    expectTypeOf<
      Shape<AnyTask, { reporter: Record<never, never>; owner: Record<never, never> }>
    >().toEqualTypeOf<
      | { id: number; type: 'bug'; severity: string; reporter: UserRow }
      | { id: number; type: 'feature'; priority: number; owner: UserRow }
      | { id: number; type: 'chore' }
    >();
    expectTypeOf<Shape<AnyTask, { assignee: Record<never, never> }>>().toEqualTypeOf<
      | { id: number; type: 'bug'; severity: string; assignee: UserRow | null }
      | { id: number; type: 'feature'; priority: number }
      | { id: number; type: 'chore' }
    >();
    expectTypeOf<
      Extract<Shape<AnyTask, { assignee: Record<never, never> }>, { type: 'chore' }>
    >().not.toHaveProperty('assignee');
  });

  test("'+' and '-' over a union name scalars of any variant", () => {
    expectTypeOf<Shape<AnyTask, { '+': 'id' | 'severity' | 'owner' }>>().toEqualTypeOf<
      { id: number; severity: string } | { id: number; owner: UserRow } | { id: number }
    >();
    expectTypeOf<Shape<AnyTask, { '-': 'severity' | 'priority' }>>().toEqualTypeOf<
      { id: number; type: 'bug' } | { id: number; type: 'feature' } | { id: number; type: 'chore' }
    >();
  });

  test('the Shape of a model is assignable from the rows a query returns', () => {
    type Response = Shape<
      User,
      { '-': 'name'; posts: { '+': 'id' | 'title'; comments: Record<never, never> } }
    >;
    const fromRow = (
      row: UserRow & { posts: (PostRow & { comments: { id: number; body: string }[] })[] },
    ): Response => {
      const { name: _name, ...rest } = row;
      return {
        ...rest,
        posts: row.posts.map(({ id, title, comments }) => ({ id, title, comments })),
      };
    };
    expectTypeOf(fromRow).returns.toEqualTypeOf<{
      id: number;
      posts: { id: number; title: string; comments: { id: number; body: string }[] }[];
    }>();
    // @ts-expect-error the body omits posts, which the shape declares
    const missingRelation = (row: UserRow): Response => row;
    expectTypeOf(missingRelation).returns.toEqualTypeOf<Response>();
  });

  test('ShapeSpec constrains a generic that forwards its spec to Shape', () => {
    type UserShape<S extends ShapeSpec<User, S>> = Shape<User, S>;
    expectTypeOf<UserShape<{ posts: Record<never, never> }>>().toEqualTypeOf<{
      id: number;
      name: string;
      posts: PostRow[];
    }>();
    expectTypeOf<UserShape<{ '+': 'id'; manager: { '-': 'name' } }>>().toEqualTypeOf<{
      id: number;
      manager: { id: number };
    }>();
  });

  test('an unknown key is constrained to a message naming the valid keys', () => {
    expectTypeOf<ShapeSpec<User, { nope: Record<never, never> }>['nope']>().toEqualTypeOf<
      | "'nope' is not a relation of the model; try '+', '-', or 'posts'"
      | "'nope' is not a relation of the model; try '+', '-', or 'profile'"
      | "'nope' is not a relation of the model; try '+', '-', or 'manager'"
    >();
    expectTypeOf<
      ShapeSpec<Profile, { nope: Record<never, never> }>['nope']
    >().toEqualTypeOf<"'nope' is not a relation of the model, which has none; try '+' or '-'">();
  });

  test("refuses a name in '+' that is neither a scalar nor a relation", () => {
    // @ts-expect-error 'nope' is not a field of User
    type _Bad = Shape<User, { '+': 'nope' }>;
    // @ts-expect-error 'nope' is not a field of User even beside a valid name
    type _Mixed = Shape<User, { '+': 'id' | 'nope' }>;
  });

  test("refuses a name in '-' that is not a scalar", () => {
    // @ts-expect-error 'nope' is not a field of User
    type _Bad = Shape<User, { '-': 'nope' }>;
  });

  test("refuses a relation name in '-'", () => {
    // @ts-expect-error 'posts' is a relation and cannot be dropped
    type _Bad = Shape<User, { '-': 'posts' }>;
  });

  test('refuses a relation key whose value is not an object', () => {
    // @ts-expect-error a relation value must be a nested spec
    type _True = Shape<User, { posts: true }>;
    // @ts-expect-error a relation value must be a nested spec
    type _String = Shape<User, { posts: 'title' }>;
  });

  test('refuses a key that is neither a relation nor a sigil', () => {
    // @ts-expect-error 'name' is a scalar, not a relation
    type _Scalar = Shape<User, { name: Record<never, never> }>;
    // @ts-expect-error 'nope' is not a relation of User
    type _Missing = Shape<User, { nope: Record<never, never> }>;
    // @ts-expect-error 'posts' is not a relation of any AnyTask member
    type _Union = Shape<AnyTask, { posts: Record<never, never> }>;
  });

  test("refuses '+' and '-' at the same level", () => {
    // @ts-expect-error '+' and '-' cannot both be given
    type _Both = Shape<User, { '+': 'id'; '-': 'name' }>;
  });

  test("refuses a relation both in '+' and as a key at the same level", () => {
    // @ts-expect-error 'posts' cannot be both kept whole and narrowed
    type _Both = Shape<User, { '+': 'posts'; posts: Record<never, never> }>;
    // @ts-expect-error 'posts' cannot be both kept whole and narrowed
    type _WithScalars = Shape<User, { '+': 'id' | 'posts'; posts: { '+': 'title' } }>;
  });

  test('refuses every rule at a nested level too', () => {
    // @ts-expect-error 'nope' is not a field of Post
    type _Plus = Shape<User, { posts: { '+': 'nope' } }>;
    // @ts-expect-error 'author' is a relation of Post and cannot be dropped
    type _Minus = Shape<User, { posts: { '-': 'author' } }>;
    // @ts-expect-error 'nope' is not a relation of Post
    type _Key = Shape<User, { posts: { nope: Record<never, never> } }>;
    // @ts-expect-error '+' and '-' cannot both be given
    type _Both = Shape<User, { posts: { '+': 'id'; '-': 'title' } }>;
    // @ts-expect-error a relation value must be a nested spec
    type _Value = Shape<User, { posts: { comments: true } }>;
    // @ts-expect-error 'author' cannot be both kept whole and narrowed
    type _Twice = Shape<User, { posts: { '+': 'author'; author: Record<never, never> } }>;
  });
});
