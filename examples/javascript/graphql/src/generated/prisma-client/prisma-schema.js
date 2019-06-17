module.exports = {
  typeDefs: /* GraphQL */ `
    type AggregatePost {
      count: Int!
    }

    type AggregateUser {
      count: Int!
    }

    type BatchPayload {
      count: Long!
    }

    scalar DateTime

    scalar Long

    type Mutation {
      createPost(data: PostCreateInput!): Post!
      updatePost(data: PostUpdateInput!, where: PostWhereUniqueInput!): Post
      updateManyPosts(
        data: PostUpdateManyMutationInput!
        where: PostWhereInput
      ): BatchPayload!
      upsertPost(
        where: PostWhereUniqueInput!
        create: PostCreateInput!
        update: PostUpdateInput!
      ): Post!
      deletePost(where: PostWhereUniqueInput!): Post
      deleteManyPosts(where: PostWhereInput): BatchPayload!
      createUser(data: UserCreateInput!): User!
      updateUser(data: UserUpdateInput!, where: UserWhereUniqueInput!): User
      updateManyUsers(
        data: UserUpdateManyMutationInput!
        where: UserWhereInput
      ): BatchPayload!
      upsertUser(
        where: UserWhereUniqueInput!
        create: UserCreateInput!
        update: UserUpdateInput!
      ): User!
      deleteUser(where: UserWhereUniqueInput!): User
      deleteManyUsers(where: UserWhereInput): BatchPayload!
    }

    enum MutationType {
      CREATED
      UPDATED
      DELETED
    }

    interface Node {
      id: ID!
    }

    type PageInfo {
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
      startCursor: String
      endCursor: String
    }

    type Post {
      id: ID!
      createdAt: DateTime!
      updatedAt: DateTime!
      published: Boolean!
      title: String!
      content: String
      author: User!
    }

    type PostConnection {
      pageInfo: PageInfo!
      edges: [PostEdge]!
      aggregate: AggregatePost!
    }

    input PostCreateInput {
      published: Boolean
      title: String!
      content: String
      author: UserCreateOneWithoutPostsInput!
    }

    input PostCreateManyWithoutAuthorInput {
      create: [PostCreateWithoutAuthorInput!]
      connect: [PostWhereUniqueInput!]
    }

    input PostCreateWithoutAuthorInput {
      published: Boolean
      title: String!
      content: String
    }

    type PostEdge {
      node: Post!
      cursor: String!
    }

    enum PostOrderByInput {
      id_ASC
      id_DESC
      createdAt_ASC
      createdAt_DESC
      updatedAt_ASC
      updatedAt_DESC
      published_ASC
      published_DESC
      title_ASC
      title_DESC
      content_ASC
      content_DESC
    }

    type PostPreviousValues {
      id: ID!
      createdAt: DateTime!
      updatedAt: DateTime!
      published: Boolean!
      title: String!
      content: String
    }

    input PostScalarWhereInput {
      id: ID
      id_not: ID
      id_in: [ID!]
      id_not_in: [ID!]
      id_lt: ID
      id_lte: ID
      id_gt: ID
      id_gte: ID
      id_contains: ID
      id_not_contains: ID
      id_starts_with: ID
      id_not_starts_with: ID
      id_ends_with: ID
      id_not_ends_with: ID
      createdAt: DateTime
      createdAt_not: DateTime
      createdAt_in: [DateTime!]
      createdAt_not_in: [DateTime!]
      createdAt_lt: DateTime
      createdAt_lte: DateTime
      createdAt_gt: DateTime
      createdAt_gte: DateTime
      updatedAt: DateTime
      updatedAt_not: DateTime
      updatedAt_in: [DateTime!]
      updatedAt_not_in: [DateTime!]
      updatedAt_lt: DateTime
      updatedAt_lte: DateTime
      updatedAt_gt: DateTime
      updatedAt_gte: DateTime
      published: Boolean
      published_not: Boolean
      title: String
      title_not: String
      title_in: [String!]
      title_not_in: [String!]
      title_lt: String
      title_lte: String
      title_gt: String
      title_gte: String
      title_contains: String
      title_not_contains: String
      title_starts_with: String
      title_not_starts_with: String
      title_ends_with: String
      title_not_ends_with: String
      content: String
      content_not: String
      content_in: [String!]
      content_not_in: [String!]
      content_lt: String
      content_lte: String
      content_gt: String
      content_gte: String
      content_contains: String
      content_not_contains: String
      content_starts_with: String
      content_not_starts_with: String
      content_ends_with: String
      content_not_ends_with: String
      AND: [PostScalarWhereInput!]
      OR: [PostScalarWhereInput!]
      NOT: [PostScalarWhereInput!]
    }

    type PostSubscriptionPayload {
      mutation: MutationType!
      node: Post
      updatedFields: [String!]
      previousValues: PostPreviousValues
    }

    input PostSubscriptionWhereInput {
      mutation_in: [MutationType!]
      updatedFields_contains: String
      updatedFields_contains_every: [String!]
      updatedFields_contains_some: [String!]
      node: PostWhereInput
      AND: [PostSubscriptionWhereInput!]
      OR: [PostSubscriptionWhereInput!]
      NOT: [PostSubscriptionWhereInput!]
    }

    input PostUpdateInput {
      published: Boolean
      title: String
      content: String
      author: UserUpdateOneRequiredWithoutPostsInput
    }

    input PostUpdateManyDataInput {
      published: Boolean
      title: String
      content: String
    }

    input PostUpdateManyMutationInput {
      published: Boolean
      title: String
      content: String
    }

    input PostUpdateManyWithoutAuthorInput {
      create: [PostCreateWithoutAuthorInput!]
      delete: [PostWhereUniqueInput!]
      connect: [PostWhereUniqueInput!]
      disconnect: [PostWhereUniqueInput!]
      update: [PostUpdateWithWhereUniqueWithoutAuthorInput!]
      upsert: [PostUpsertWithWhereUniqueWithoutAuthorInput!]
      deleteMany: [PostScalarWhereInput!]
      updateMany: [PostUpdateManyWithWhereNestedInput!]
    }

    input PostUpdateManyWithWhereNestedInput {
      where: PostScalarWhereInput!
      data: PostUpdateManyDataInput!
    }

    input PostUpdateWithoutAuthorDataInput {
      published: Boolean
      title: String
      content: String
    }

    input PostUpdateWithWhereUniqueWithoutAuthorInput {
      where: PostWhereUniqueInput!
      data: PostUpdateWithoutAuthorDataInput!
    }

    input PostUpsertWithWhereUniqueWithoutAuthorInput {
      where: PostWhereUniqueInput!
      update: PostUpdateWithoutAuthorDataInput!
      create: PostCreateWithoutAuthorInput!
    }

    input PostWhereInput {
      id: ID
      id_not: ID
      id_in: [ID!]
      id_not_in: [ID!]
      id_lt: ID
      id_lte: ID
      id_gt: ID
      id_gte: ID
      id_contains: ID
      id_not_contains: ID
      id_starts_with: ID
      id_not_starts_with: ID
      id_ends_with: ID
      id_not_ends_with: ID
      createdAt: DateTime
      createdAt_not: DateTime
      createdAt_in: [DateTime!]
      createdAt_not_in: [DateTime!]
      createdAt_lt: DateTime
      createdAt_lte: DateTime
      createdAt_gt: DateTime
      createdAt_gte: DateTime
      updatedAt: DateTime
      updatedAt_not: DateTime
      updatedAt_in: [DateTime!]
      updatedAt_not_in: [DateTime!]
      updatedAt_lt: DateTime
      updatedAt_lte: DateTime
      updatedAt_gt: DateTime
      updatedAt_gte: DateTime
      published: Boolean
      published_not: Boolean
      title: String
      title_not: String
      title_in: [String!]
      title_not_in: [String!]
      title_lt: String
      title_lte: String
      title_gt: String
      title_gte: String
      title_contains: String
      title_not_contains: String
      title_starts_with: String
      title_not_starts_with: String
      title_ends_with: String
      title_not_ends_with: String
      content: String
      content_not: String
      content_in: [String!]
      content_not_in: [String!]
      content_lt: String
      content_lte: String
      content_gt: String
      content_gte: String
      content_contains: String
      content_not_contains: String
      content_starts_with: String
      content_not_starts_with: String
      content_ends_with: String
      content_not_ends_with: String
      author: UserWhereInput
      AND: [PostWhereInput!]
      OR: [PostWhereInput!]
      NOT: [PostWhereInput!]
    }

    input PostWhereUniqueInput {
      id: ID
    }

    type Query {
      post(where: PostWhereUniqueInput!): Post
      posts(
        where: PostWhereInput
        orderBy: PostOrderByInput
        skip: Int
        after: String
        before: String
        first: Int
        last: Int
      ): [Post]!
      postsConnection(
        where: PostWhereInput
        orderBy: PostOrderByInput
        skip: Int
        after: String
        before: String
        first: Int
        last: Int
      ): PostConnection!
      user(where: UserWhereUniqueInput!): User
      users(
        where: UserWhereInput
        orderBy: UserOrderByInput
        skip: Int
        after: String
        before: String
        first: Int
        last: Int
      ): [User]!
      usersConnection(
        where: UserWhereInput
        orderBy: UserOrderByInput
        skip: Int
        after: String
        before: String
        first: Int
        last: Int
      ): UserConnection!
      node(id: ID!): Node
    }

    type Subscription {
      post(where: PostSubscriptionWhereInput): PostSubscriptionPayload
      user(where: UserSubscriptionWhereInput): UserSubscriptionPayload
    }

    type User {
      id: ID!
      email: String!
      name: String
      posts(
        where: PostWhereInput
        orderBy: PostOrderByInput
        skip: Int
        after: String
        before: String
        first: Int
        last: Int
      ): [Post!]
    }

    type UserConnection {
      pageInfo: PageInfo!
      edges: [UserEdge]!
      aggregate: AggregateUser!
    }

    input UserCreateInput {
      email: String!
      name: String
      posts: PostCreateManyWithoutAuthorInput
    }

    input UserCreateOneWithoutPostsInput {
      create: UserCreateWithoutPostsInput
      connect: UserWhereUniqueInput
    }

    input UserCreateWithoutPostsInput {
      email: String!
      name: String
    }

    type UserEdge {
      node: User!
      cursor: String!
    }

    enum UserOrderByInput {
      id_ASC
      id_DESC
      email_ASC
      email_DESC
      name_ASC
      name_DESC
      createdAt_ASC
      createdAt_DESC
      updatedAt_ASC
      updatedAt_DESC
    }

    type UserPreviousValues {
      id: ID!
      email: String!
      name: String
    }

    type UserSubscriptionPayload {
      mutation: MutationType!
      node: User
      updatedFields: [String!]
      previousValues: UserPreviousValues
    }

    input UserSubscriptionWhereInput {
      mutation_in: [MutationType!]
      updatedFields_contains: String
      updatedFields_contains_every: [String!]
      updatedFields_contains_some: [String!]
      node: UserWhereInput
      AND: [UserSubscriptionWhereInput!]
      OR: [UserSubscriptionWhereInput!]
      NOT: [UserSubscriptionWhereInput!]
    }

    input UserUpdateInput {
      email: String
      name: String
      posts: PostUpdateManyWithoutAuthorInput
    }

    input UserUpdateManyMutationInput {
      email: String
      name: String
    }

    input UserUpdateOneRequiredWithoutPostsInput {
      create: UserCreateWithoutPostsInput
      update: UserUpdateWithoutPostsDataInput
      upsert: UserUpsertWithoutPostsInput
      connect: UserWhereUniqueInput
    }

    input UserUpdateWithoutPostsDataInput {
      email: String
      name: String
    }

    input UserUpsertWithoutPostsInput {
      update: UserUpdateWithoutPostsDataInput!
      create: UserCreateWithoutPostsInput!
    }

    input UserWhereInput {
      id: ID
      id_not: ID
      id_in: [ID!]
      id_not_in: [ID!]
      id_lt: ID
      id_lte: ID
      id_gt: ID
      id_gte: ID
      id_contains: ID
      id_not_contains: ID
      id_starts_with: ID
      id_not_starts_with: ID
      id_ends_with: ID
      id_not_ends_with: ID
      email: String
      email_not: String
      email_in: [String!]
      email_not_in: [String!]
      email_lt: String
      email_lte: String
      email_gt: String
      email_gte: String
      email_contains: String
      email_not_contains: String
      email_starts_with: String
      email_not_starts_with: String
      email_ends_with: String
      email_not_ends_with: String
      name: String
      name_not: String
      name_in: [String!]
      name_not_in: [String!]
      name_lt: String
      name_lte: String
      name_gt: String
      name_gte: String
      name_contains: String
      name_not_contains: String
      name_starts_with: String
      name_not_starts_with: String
      name_ends_with: String
      name_not_ends_with: String
      posts_every: PostWhereInput
      posts_some: PostWhereInput
      posts_none: PostWhereInput
      AND: [UserWhereInput!]
      OR: [UserWhereInput!]
      NOT: [UserWhereInput!]
    }

    input UserWhereUniqueInput {
      id: ID
      email: String
    }
  `,
}
