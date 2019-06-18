# GraphQL Server with Authentication & Permissions

This example shows how to implement a **GraphQL server with an email-password-based authentication workflow and authentication rules** based on Prisma, [graphql-yoga](https://github.com/prisma/graphql-yoga) & [graphql-shield](https://github.com/maticzav/graphql-shield).

**INLINE(../\_setup-1.md)**
cd examples/javascript/graphql-auth
**INLINE(../\_setup-2.md)**

**INLINE(../\_start-graphql-server.md)**

**INLINE(../../\_using-the-graphql-api-auth.md)**

### 6. Evolving the example

If you want to change the GraphQL API, you need to adjust the GraphQL schema in [`./src/schema.graphql`](./src/schema.graphql) and the respective resolver functions.

<Details><Summary><strong>Adding an operation without updating the datamodel</strong></Summary>

To add new operation that can be based on the current [datamodel](./prisma/datamodel.prisma), you first need to add the operation to the GraphQL schema's `Query` or `Mutation` type and then add the corresponding resolver function.

For example, to add a new mutation that updates a user's name, you can extend the `Mutation` type as follows:

```diff
type Mutation {
  signupUser(email: String!, name: String): User!
  createDraft(title: String!, content: String, authorEmail: String!): Post!
  deletePost(id: ID!): Post
  publish(id: ID!): Post
+ updateUserName(id: ID!, newName: String!): User
}
```

Then add the new resolver to the `Mutation` object in [`./src/resolvers/Mutation.js`](./src/resolvers/Mutation.js):

```diff
const Mutation = {
  // ...
+ updateUserName(parent, { id, newName }, context) {
+   return context.prisma.updateUser({
+     where: {
+       id
+     },
+     data: {
+       name: newName
+     }
+   })
+ }
}
```

You can now send the following mutation to your GraphQL API:

```graphql
mutation {
  updateUserName(
    id: "__USER_ID__"
    newName: "John")
  ) {
    id
    name
  }
}
```

</Details>

<Details><Summary><strong>Adding an operation and updating the datamodel</strong></Summary>

Some new API features can't be covered with the existing datamodel. For example, you might want to add _comment_ feature to the API, so that users can leave comments on posts.

For that, you first need to adjust the Prisma datamodel in [`./prisma/datamodel.prisma`](./prisma/datamodel.prisma):

```diff
type User {
  id: ID! @id
  email: String! @unique
  name: String
  posts: [Post!]!
+ comments: [Comment!]!
}

type Post {
  id: ID! @id
  createdAt: DateTime!
  updatedAt: DateTime!
  published: Boolean! @default(value: "false")
  title: String!
  content: String
  author: User!
+ comments: [Comment!]!
}

+ type Comment {
+   id: ID! @id
+   text: String!
+   writtenBy: User!
+   post: Post!
+ }
```

After having updated the datamodel, you need to deploy the changes:

```
prisma deploy
```

Note that this also invokes `prisma generate` (because of the `post-deploy` hook in [`prisma.yml`](./prisma/prisma.yml)) which regenerates the Prisma client in [`./src/generated/prisma-client`](./src/generated/prisma-client).

To now enable users to add comments to posts, you need to add the `Comment` type as well as the corresponding operation to the GraphQL schema in [`./src/schema.graphql`](./src/schema.graphql):

```diff
type Query {
  # ... as before
}

type Mutation {
  signupUser(email: String!, name: String): User!
  createDraft(title: String!, content: String, authorEmail: String!): Post!
  deletePost(id: ID!): Post
  publish(id: ID!): Post
  updateUserName(id: ID!, newName: String!): User
+ writeComment(text: String!, postId: ID!): Comment
}

type User {
  id: ID!
  email: String!
  name: String
  posts: [Post!]!
+ comments: [Comment!]!
}

type Post {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  published: Boolean!
  title: String!
  content: String
  author: User!
+ comments: [Comment!]!
}

+ type Comment {
+   id: ID!
+   text: String!
+   writtenBy: User!
+   post: Post!
+ }
```

Next, you need to implement the resolver for the new operation in [`./src/resolvers/Mutation.js`](./src/resolvers/Mutation.js):

```diff
const resolvers = {
  // ...
  Mutation: {
    // ...
+   writeComment(parent, { postId, userId }, context) {
+     const userId = getUserId(context)
+     return context.prisma.createComment({
+       text,
+       post: {
+         connect: { id: postId }
+       },
+       writtenBy: {
+         connect: { id: userId }
+       }
+     })
+   }
  }
}
```

Finally, because `Comment` has a relation to `Post` and `User`, you need to update the type resolvers as well so that the relation can be properly resolved (learn more about why this is necessary in [this](https://www.prisma.io/blog/graphql-server-basics-the-schema-ac5e2950214e/) blog article):

```diff
const resolvers = {
  // ...
  User: {
    // ...
+   comments: ({ id }, args, context) {
+     return context.prisma.user({ id }).comments()
+   }
  },
  Post: {
    // ...
+   comments: ({ id }, args, context) {
+     return context.prisma.post({ id }).comments()
+   }
  },
+ Comment: {
+   writtenBy: ({ id }, args, context) {
+     return context.prisma.comment({ id }).writtenBy()
+   },
+   post: ({ id }, args, context) {
+     return context.prisma.comment({ id }).post()
+   },
+ }
}
```

You can now send the following mutation to your GraphQL API. Note that this mutation only works if you're authenticated through a valid token in the `Authorization` header.

```graphql
mutation {
  writeComment(postId: "__POST_ID__", text: "I like turtles 🐢") {
    id
    name
  }
}
```

</Details>

**INLINE(../\_next-steps.md)**

## The idea behind the example

The Prisma client is used as a replacement for a traditional ORM in this example. It bridges the gap between your GraphQL resolvers and your database by providing a powerful CRUD API for the types that are defined in your Prisma datamodel.
