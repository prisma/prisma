# Working with Prisma Client JS' generated types

The generated code for Prisma Client JS contains a number of helpful types that you can use to make your application more type-safe. This page describes patterns for leveraging some of the generated types.

## Operating against partial structures of your model types

When using Prisma Client JS, every model from your [Prisma schema](../prisma-schema-file.md) is translated into a dedicated TypeScript type. For example, assume you have the following `User` and `Post` models:

```prisma
model User {
  id        Int      @id
  email     String   @unique
  name      String?
  posts     Post[]
}

model Post {
  id         Int        @id
  author     User
  title      String
  published  Boolean    @default(false)
}
```

The Prisma Client JS code that's generated from this schema contains a representation of the `User` type:

```ts
export declare type User = {
    id: string;
    email: string;
    name: string | null;
};
```

### Problem: Using variations of the generated model type

#### Description

In some scenarios, you may need a variation of the generated `User` type. For example, when you have a function that expects an instance of the `User` model that carries the `posts` relation. Or when you need a type to pass only the `User` model's `email` and `name` fields around in your application code.

#### Solution

As a solution, you can customize the generated model type using Prisma Client JS' helper types.

The `User` type only contains the model's [scalar](../data-modeling.md#scalar-types) fields, but doesn't account for any relations. That's because [relations are not included by default](./api.md#the-default-selection-set) in Prisma Client JS' API calls.

However, sometimes it's useful to have a type available that **includes a relation** (i.e. a type that you'd get from an API call that uses [`include`](./api.md#include-additionally-via-include)). Similarly, another useful scenario could be to have a type available that **includes only a subset of the model's scalar fields** (i.e. a type that you'd get from an API call that uses [`select`](./api.md#select-exclusively-via-select). 

One way of achieving this would be to define these types manually in your application code:

```ts
// Define a type that includes the relation to `Post` 
type UserWithPosts = {
  id: string;
  email: string;
  name: string | null;
  posts: Post[]
}

// Define a type that only contains a subset of the scalar fields
type UserPersonalData = {
  email: string;
  name: string | null;
}
```

While this is certainly feasible, this approach increases the maintenance burden upon changes to the Prisma schema as you need to manually maintain the types. A cleaner solution to this is to use the  `UserGetIncludePayload` and  `UserGetSelectPayload` types that are generated and exposed by Prisma Client JS:

```ts
// Define a type that includes the relation to `Post` 
type UserWithPosts = UserGetIncludePayload<{
  posts: true
}>

// Define a type that only contains a subset of the scalar fields
type UserPersonalData = UserGetSelectPayload<{
  email: true;
  name: true;
}>
```

The main benefits of the latter approach are:

- Cleaner approach as it leverages Prisma Client JS' generated types
- Reduced maintenance burden and improved type-safety when the schema changes

### Problem: Getting access to the return type of a partial structure

#### Description

When doing [`select`](./api.md#select-exclusively-via-select) or [`include`](./api.md#include-additionally-via-include) operations on your models it is difficult to gain access to the return type, e.g:

```ts
async function getUsersWithPosts() {
  const users = await prisma.user.findMany({ include: { posts: true } })
  return users
}
```

Extracting the type that represents "users with posts" from the above code snippet requires some advanced TypeScript usage:

```ts
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
type UsersWithPosts = ThenArg<ReturnType<typeof getUsersWithPosts>>;
```

#### Solution

With the `PromiseReturnType` that is exposed by Prisma Client, you can solve this more elegantly:

```ts
import { PromiseReturnType } from '@prisma/client'

type UsersWithPosts = PromiseReturnType<typeof getUsersWithPosts>;
```