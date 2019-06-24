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