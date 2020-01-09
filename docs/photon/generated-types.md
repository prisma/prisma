# Working with Photon.js' generated types

The generated code for Photon.js contains a number of helpful types that you can use to make your application more type-safe. This page describes a patterns for leveraging some of the generated types.

## Operating against partial structures of your model types

When using Photon.js, every model from your [Prisma schema](../prisma-schema-file.md) is translated into a dedicated TypeScript type. For example, assume you have the following `User` and `Post` models:

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

The Photon.js code that's generated from this schema contains a representation of the `User` type:

```ts
export declare type User = {
    id: string;
    email: string;
    name: string | null;
};
```

The `User` type only contains the model's [scalar]() fields, but doesn't account for any relations. That's because [relations are not included by default]() in Photon.js' API calls. 

However, sometimes it's useful to have a type available that **includes a relation** (i.e. a type that you'd get from an API call that uses [`include`]()). Similarly, another useful scenario could be to have a type available that **includes only a subset of the model's scalar fields** (i.e. a type that you'd get from an API call that uses [`select`]()). 

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

While this is certainly feasible, this approach increases the maintenance burden upon changes to the Prisma schema as you need to manually maintain the types. A cleaner solution to this is to use the  `UserGetIncludePayload` and  `UserGetSelectPayload` types that are generated and exposed by Photon.js:

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
