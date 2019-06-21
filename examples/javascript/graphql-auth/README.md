# GraphQL Server with Authentication & Permissions

This example shows how to implement a **GraphQL server with an email-password-based authentication workflow and authentication rules** based on Prisma, [graphql-yoga](https://github.com/prisma/graphql-yoga) & [graphql-shield](https://github.com/maticzav/graphql-shield).

## How to use

### 1. Download example & install dependencies

Clone the repository:

```
git clone git@github.com:prisma/photonjs.git
```

Install Node dependencies:

```
cd examples/javascript/graphql-auth
npm install
```

### 2. Install the Prisma CLI

To run the example, you need the Prisma CLI. Please install it via NPM.

```
npm install -g prisma2
```

### 3. Set up database & deploy Prisma schema

```
prisma2 lift save --name 'init'
prisma2 lift up
prisma2 generate
```

### 4. Start the GraphQL server

Launch your GraphQL server with this command:

```
npm run start
```

Navigate to [http://localhost:4000](http://localhost:4000) in your browser to explore the API of your GraphQL server in a [GraphQL Playground](https://github.com/prisma/graphql-playground).

### 5. Using the GraphQL API

The schema that specifies the API operations of your GraphQL server is defined in [`./src/schema.graphql`](./src/schema.graphql). Below are a number of operations that you can send to the API using the GraphQL Playground.

Feel free to adjust any operation by adding or removing fields. The GraphQL Playground helps you with its auto-completion and query validation features.

#### Retrieve all published posts and their authors

```graphql
query {
  feed {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

<Details><Summary><strong>See more API operations</strong></Summary>

#### Register a new user

You can send the following mutation in the Playground to sign up a new user and retrieve an authentication token for them:

```graphql
mutation {
  signup(name: "Alice", email: "alice@prisma.io", password: "graphql") {
    token
  }
}
```

#### Log in an existing user

This mutation will log in an existing user by requesting a new authentication token for them:

```graphql
mutation {
  login(email: "alice@prisma.io", password: "graphql") {
    token
  }
}
```

#### Check whether a user is currently logged in with the `me` query

For this query, you need to make sure a valid authentication token is sent along with the `Bearer`-prefix in the `Authorization` header of the request:

```json
{
  "Authorization": "Bearer __YOUR_TOKEN__"
}
```

With a real token, this looks similar to this:

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjanAydHJyczFmczE1MGEwM3kxaWl6c285IiwiaWF0IjoxNTQzNTA5NjY1fQ.Vx6ad6DuXA0FSQVyaIngOHYVzjKwbwq45flQslnqX04"
}
```

Inside the Playground, you can set HTTP headers in the bottom-left corner:

![](https://imgur.com/ToRcCTj.png)

Once you've set the header, you can send the following query to check whether the token is valid:

```graphql
{
  me {
    id
    name
    email
  }
}
```

#### Create a new draft

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground.

```graphql
mutation {
  createDraft(
    title: "Join the Prisma Slack"
    content: "https://slack.prisma.io"
  ) {
    id
    published
  }
}
```

#### Publish an existing draft

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. The authentication token must belong to the user who created the post.

```graphql
mutation {
  publish(id: "__POST_ID__") {
    id
    published
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

#### Search for posts with a specific title or content

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. 

```graphql
{
  filterPosts(searchString: "graphql") {
    id
    title
    content
    published 
    author {
      id
      name
      email
    }
  }
}
```

#### Retrieve a single post

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. 

```graphql
{
  post(id: "__POST_ID__") {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

#### Delete a post

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. The authentication token must belong to the user who created the post.

```graphql
mutation {
  deletePost(id: "__POST_ID__") {
    id
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

</Details>

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
+ updateUserName: async (parent, { id, newName }, context) => { 
+   return context.photon.users.update({
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
  writeComment(
    postId: "__POST_ID__" 
    text: "I like turtles 🐢"
  ) {
    id
    name
  }
}
```

</Details>

## Next steps

- [Use Prisma with an existing database](https://github.com/prisma/prisma2-docs/blob/master/introspection.md)
- [Explore the Photon API](https://github.com/prisma/prisma2-docs/blob/master/photon/api.md)

## The idea behind the example

The Prisma client is used as a replacement for a traditional ORM in this example. It bridges the gap between your GraphQL resolvers and your database by providing a powerful CRUD API for the types that are defined in your Prisma datamodel.
