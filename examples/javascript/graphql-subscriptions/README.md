# GraphQL Server with Realtime Subscriptions Example

**This example is currently in the works, it will be available soon!**

This example shows how to implement **GraphQL server with realtime subscriptions** based on Prisma & [graphql-yoga](https://github.com/prisma/graphql-yoga).

> To learn more about implementing GraphQL subscriptions with Prisma, visit [this](https://www.prisma.io/tutorials/build-a-realtime-graphql-server-with-subscriptions-ct11/) tutorial.

## How to use

### 1. Download example & install dependencies

Clone the repository:

```
git clone git@github.com:prisma/photonjs.git
```

Install Node dependencies:

```
cd prisma-examples/node/graphql-subscriptions
npm install
```

### 2. Install the Prisma 2 CLI

To run the example, you need the [Prisma 2 CLI](https://github.com/prisma/prisma2-docs/blob/master/prisma-2-cli.md):

```
npm install -g prisma2
```

### 3. Set up database

For this example, you'll use a simple [SQLite database](https://www.sqlite.org/index.html). To set up your database, run:

```
prisma2 lift save --name 'init'
prisma2 lift up
```

You can now use the [SQLite Browser](https://sqlitebrowser.org/) to view and edit your data in the `./prisma/dev.db` file that was created when you ran `prisma2 lift up`.

### 4. Generate Photon (type-safe database client)

Run the following command to generate [Photon JS](https://photonjs.prisma.io/):

```
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

#### Retrieve all published posts

```graphql
query {
  feed {
    id
    title
    content
    published
  }
}
```

<Details><Summary><strong>See more API operations</strong></Summary>

#### Create a new draft

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

```graphql
{
  filterPosts(searchString: "graphql") {
    id
    title
    content
    published
  }
}
```

#### Retrieve a single post

```graphql
{
  posts(id: "__POST_ID__") {
    id
    title
    content
    published
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

#### Delete a post

```graphql
mutation {
  deletePost(id: "__POST_ID__") {
    id
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

</Details>

### 6. Testing GraphQL subscriptions in the Playground

To test the `post` subscription, you need to send a subscription query in the Playground, e.g.:

```graphql
subscription {
  posts {
    id
    createdAt
    title
    content
    published
  }
}
```

When hitting the _Play_-button, you won't see an immediate response. Instead there's a loading indicator in the response pane of the Playground:

![](https://imgur.com/l4WObKG.png)

Now, whenever a post is created (or updated), e.g. with this mutation (you can run it in another tab):

```graphql
mutation {
  createDraft(
    title: "Join the Prisma community on Slack"
    content: "https://slack.prisma.io"
  ) {
    id
  }
}
```

You will see the results appear in the tab where the subscription is running:

![](https://imgur.com/HRWDPsE.png)

## Next steps

- Read the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/)
- Check out the [Prisma 2 docs](https://github.com/prisma/prisma2-docs)
- Share your feedback in the [`prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on the Prisma Slack
