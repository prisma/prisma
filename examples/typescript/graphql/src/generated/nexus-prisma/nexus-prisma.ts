// GENERATED TYPES FOR NEXUS-PRISMA. /!\ DO NOT EDIT MANUALLY

import { core } from 'nexus'
import { GraphQLResolveInfo } from 'graphql'
import * as prisma from '../prisma-client'

declare global {
  interface NexusPrismaGen extends NexusPrismaTypes {}
}

export interface NexusPrismaTypes {
  objectTypes: {
    fields: {
      Query: QueryObject
      User: UserObject
      Post: PostObject
      UserConnection: UserConnectionObject
      PageInfo: PageInfoObject
      UserEdge: UserEdgeObject
      AggregateUser: AggregateUserObject
      PostConnection: PostConnectionObject
      PostEdge: PostEdgeObject
      AggregatePost: AggregatePostObject
      Mutation: MutationObject
      BatchPayload: BatchPayloadObject
      Subscription: SubscriptionObject
      UserSubscriptionPayload: UserSubscriptionPayloadObject
      UserPreviousValues: UserPreviousValuesObject
      PostSubscriptionPayload: PostSubscriptionPayloadObject
      PostPreviousValues: PostPreviousValuesObject
    }
    fieldsDetails: {
      Query: QueryFieldDetails
      User: UserFieldDetails
      Post: PostFieldDetails
      UserConnection: UserConnectionFieldDetails
      PageInfo: PageInfoFieldDetails
      UserEdge: UserEdgeFieldDetails
      AggregateUser: AggregateUserFieldDetails
      PostConnection: PostConnectionFieldDetails
      PostEdge: PostEdgeFieldDetails
      AggregatePost: AggregatePostFieldDetails
      Mutation: MutationFieldDetails
      BatchPayload: BatchPayloadFieldDetails
      Subscription: SubscriptionFieldDetails
      UserSubscriptionPayload: UserSubscriptionPayloadFieldDetails
      UserPreviousValues: UserPreviousValuesFieldDetails
      PostSubscriptionPayload: PostSubscriptionPayloadFieldDetails
      PostPreviousValues: PostPreviousValuesFieldDetails
    }
  }
  inputTypes: {
    fields: {
      UserWhereUniqueInput: UserWhereUniqueInputInputObject
      PostWhereInput: PostWhereInputInputObject
      UserWhereInput: UserWhereInputInputObject
      PostWhereUniqueInput: PostWhereUniqueInputInputObject
      UserCreateInput: UserCreateInputInputObject
      PostCreateManyWithoutAuthorInput: PostCreateManyWithoutAuthorInputInputObject
      PostCreateWithoutAuthorInput: PostCreateWithoutAuthorInputInputObject
      UserUpdateInput: UserUpdateInputInputObject
      PostUpdateManyWithoutAuthorInput: PostUpdateManyWithoutAuthorInputInputObject
      PostUpdateWithWhereUniqueWithoutAuthorInput: PostUpdateWithWhereUniqueWithoutAuthorInputInputObject
      PostUpdateWithoutAuthorDataInput: PostUpdateWithoutAuthorDataInputInputObject
      PostUpsertWithWhereUniqueWithoutAuthorInput: PostUpsertWithWhereUniqueWithoutAuthorInputInputObject
      PostScalarWhereInput: PostScalarWhereInputInputObject
      PostUpdateManyWithWhereNestedInput: PostUpdateManyWithWhereNestedInputInputObject
      PostUpdateManyDataInput: PostUpdateManyDataInputInputObject
      UserUpdateManyMutationInput: UserUpdateManyMutationInputInputObject
      PostCreateInput: PostCreateInputInputObject
      UserCreateOneWithoutPostsInput: UserCreateOneWithoutPostsInputInputObject
      UserCreateWithoutPostsInput: UserCreateWithoutPostsInputInputObject
      PostUpdateInput: PostUpdateInputInputObject
      UserUpdateOneRequiredWithoutPostsInput: UserUpdateOneRequiredWithoutPostsInputInputObject
      UserUpdateWithoutPostsDataInput: UserUpdateWithoutPostsDataInputInputObject
      UserUpsertWithoutPostsInput: UserUpsertWithoutPostsInputInputObject
      PostUpdateManyMutationInput: PostUpdateManyMutationInputInputObject
      UserSubscriptionWhereInput: UserSubscriptionWhereInputInputObject
      PostSubscriptionWhereInput: PostSubscriptionWhereInputInputObject
    }
  }
  enumTypes: {
    PostOrderByInput: PostOrderByInputValues
    UserOrderByInput: UserOrderByInputValues
    MutationType: MutationTypeValues
  }
}

// Types for Query

type QueryObject =
  | QueryFields
  | { name: 'user'; args?: QueryUserArgs[] | false; alias?: string }
  | { name: 'users'; args?: QueryUsersArgs[] | false; alias?: string }
  | {
      name: 'usersConnection'
      args?: QueryUsersConnectionArgs[] | false
      alias?: string
    }
  | { name: 'post'; args?: QueryPostArgs[] | false; alias?: string }
  | { name: 'posts'; args?: QueryPostsArgs[] | false; alias?: string }
  | {
      name: 'postsConnection'
      args?: QueryPostsConnectionArgs[] | false
      alias?: string
    }
  | { name: 'node'; args?: QueryNodeArgs[] | false; alias?: string }

type QueryFields =
  | 'user'
  | 'users'
  | 'usersConnection'
  | 'post'
  | 'posts'
  | 'postsConnection'
  | 'node'

type QueryUserArgs = 'where'
type QueryUsersArgs =
  | 'where'
  | 'orderBy'
  | 'skip'
  | 'after'
  | 'before'
  | 'first'
  | 'last'
type QueryUsersConnectionArgs =
  | 'where'
  | 'orderBy'
  | 'skip'
  | 'after'
  | 'before'
  | 'first'
  | 'last'
type QueryPostArgs = 'where'
type QueryPostsArgs =
  | 'where'
  | 'orderBy'
  | 'skip'
  | 'after'
  | 'before'
  | 'first'
  | 'last'
type QueryPostsConnectionArgs =
  | 'where'
  | 'orderBy'
  | 'skip'
  | 'after'
  | 'before'
  | 'first'
  | 'last'
type QueryNodeArgs = 'id'

export interface QueryFieldDetails {
  user: {
    type: 'User'
    args: Record<QueryUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Query'>,
      args: { where: UserWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User | null> | prisma.User | null
  }
  users: {
    type: 'User'
    args: Record<QueryUsersArgs, core.NexusArgDef<string>>
    description: string
    list: true
    nullable: false
    resolve: (
      root: core.RootValue<'Query'>,
      args: {
        where?: UserWhereInput | null
        orderBy?: prisma.UserOrderByInput | null
        skip?: number | null
        after?: string | null
        before?: string | null
        first?: number | null
        last?: number | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User[]> | prisma.User[]
  }
  usersConnection: {
    type: 'UserConnection'
    args: Record<QueryUsersConnectionArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Query'>,
      args: {
        where?: UserWhereInput | null
        orderBy?: prisma.UserOrderByInput | null
        skip?: number | null
        after?: string | null
        before?: string | null
        first?: number | null
        last?: number | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.UserConnection> | prisma.UserConnection
  }
  post: {
    type: 'Post'
    args: Record<QueryPostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Query'>,
      args: { where: PostWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post | null> | prisma.Post | null
  }
  posts: {
    type: 'Post'
    args: Record<QueryPostsArgs, core.NexusArgDef<string>>
    description: string
    list: true
    nullable: false
    resolve: (
      root: core.RootValue<'Query'>,
      args: {
        where?: PostWhereInput | null
        orderBy?: prisma.PostOrderByInput | null
        skip?: number | null
        after?: string | null
        before?: string | null
        first?: number | null
        last?: number | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post[]> | prisma.Post[]
  }
  postsConnection: {
    type: 'PostConnection'
    args: Record<QueryPostsConnectionArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Query'>,
      args: {
        where?: PostWhereInput | null
        orderBy?: prisma.PostOrderByInput | null
        skip?: number | null
        after?: string | null
        before?: string | null
        first?: number | null
        last?: number | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.PostConnection> | prisma.PostConnection
  }
  node: {
    type: 'Node'
    args: Record<QueryNodeArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Query'>,
      args: { id: string },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Node | null> | prisma.Node | null
  }
}

// Types for User

type UserObject =
  | UserFields
  | { name: 'id'; args?: [] | false; alias?: string }
  | { name: 'email'; args?: [] | false; alias?: string }
  | { name: 'name'; args?: [] | false; alias?: string }
  | { name: 'posts'; args?: UserPostsArgs[] | false; alias?: string }

type UserFields = 'id' | 'email' | 'name' | 'posts'

type UserPostsArgs =
  | 'where'
  | 'orderBy'
  | 'skip'
  | 'after'
  | 'before'
  | 'first'
  | 'last'

export interface UserFieldDetails {
  id: {
    type: 'ID'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  email: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  name: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
  posts: {
    type: 'Post'
    args: Record<UserPostsArgs, core.NexusArgDef<string>>
    description: string
    list: true
    nullable: false
    resolve: (
      root: core.RootValue<'User'>,
      args: {
        where?: PostWhereInput | null
        orderBy?: prisma.PostOrderByInput | null
        skip?: number | null
        after?: string | null
        before?: string | null
        first?: number | null
        last?: number | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post[]> | prisma.Post[]
  }
}

// Types for Post

type PostObject =
  | PostFields
  | { name: 'id'; args?: [] | false; alias?: string }
  | { name: 'createdAt'; args?: [] | false; alias?: string }
  | { name: 'updatedAt'; args?: [] | false; alias?: string }
  | { name: 'published'; args?: [] | false; alias?: string }
  | { name: 'title'; args?: [] | false; alias?: string }
  | { name: 'content'; args?: [] | false; alias?: string }
  | { name: 'author'; args?: [] | false; alias?: string }

type PostFields =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'published'
  | 'title'
  | 'content'
  | 'author'

export interface PostFieldDetails {
  id: {
    type: 'ID'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  createdAt: {
    type: 'DateTime'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  updatedAt: {
    type: 'DateTime'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  published: {
    type: 'Boolean'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  title: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  content: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
  author: {
    type: 'User'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Post'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User> | prisma.User
  }
}

// Types for UserConnection

type UserConnectionObject =
  | UserConnectionFields
  | { name: 'pageInfo'; args?: [] | false; alias?: string }
  | { name: 'edges'; args?: [] | false; alias?: string }
  | { name: 'aggregate'; args?: [] | false; alias?: string }

type UserConnectionFields = 'pageInfo' | 'edges' | 'aggregate'

export interface UserConnectionFieldDetails {
  pageInfo: {
    type: 'PageInfo'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'UserConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.PageInfo> | prisma.PageInfo
  }
  edges: {
    type: 'UserEdge'
    args: {}
    description: string
    list: true
    nullable: false
    resolve: (
      root: core.RootValue<'UserConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.UserEdge[]> | prisma.UserEdge[]
  }
  aggregate: {
    type: 'AggregateUser'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'UserConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.AggregateUser> | prisma.AggregateUser
  }
}

// Types for PageInfo

type PageInfoObject =
  | PageInfoFields
  | { name: 'hasNextPage'; args?: [] | false; alias?: string }
  | { name: 'hasPreviousPage'; args?: [] | false; alias?: string }
  | { name: 'startCursor'; args?: [] | false; alias?: string }
  | { name: 'endCursor'; args?: [] | false; alias?: string }

type PageInfoFields =
  | 'hasNextPage'
  | 'hasPreviousPage'
  | 'startCursor'
  | 'endCursor'

export interface PageInfoFieldDetails {
  hasNextPage: {
    type: 'Boolean'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  hasPreviousPage: {
    type: 'Boolean'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  startCursor: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
  endCursor: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
}

// Types for UserEdge

type UserEdgeObject =
  | UserEdgeFields
  | { name: 'node'; args?: [] | false; alias?: string }
  | { name: 'cursor'; args?: [] | false; alias?: string }

type UserEdgeFields = 'node' | 'cursor'

export interface UserEdgeFieldDetails {
  node: {
    type: 'User'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'UserEdge'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User> | prisma.User
  }
  cursor: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
}

// Types for AggregateUser

type AggregateUserObject =
  | AggregateUserFields
  | { name: 'count'; args?: [] | false; alias?: string }

type AggregateUserFields = 'count'

export interface AggregateUserFieldDetails {
  count: {
    type: 'Int'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
}

// Types for PostConnection

type PostConnectionObject =
  | PostConnectionFields
  | { name: 'pageInfo'; args?: [] | false; alias?: string }
  | { name: 'edges'; args?: [] | false; alias?: string }
  | { name: 'aggregate'; args?: [] | false; alias?: string }

type PostConnectionFields = 'pageInfo' | 'edges' | 'aggregate'

export interface PostConnectionFieldDetails {
  pageInfo: {
    type: 'PageInfo'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'PostConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.PageInfo> | prisma.PageInfo
  }
  edges: {
    type: 'PostEdge'
    args: {}
    description: string
    list: true
    nullable: false
    resolve: (
      root: core.RootValue<'PostConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.PostEdge[]> | prisma.PostEdge[]
  }
  aggregate: {
    type: 'AggregatePost'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'PostConnection'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.AggregatePost> | prisma.AggregatePost
  }
}

// Types for PostEdge

type PostEdgeObject =
  | PostEdgeFields
  | { name: 'node'; args?: [] | false; alias?: string }
  | { name: 'cursor'; args?: [] | false; alias?: string }

type PostEdgeFields = 'node' | 'cursor'

export interface PostEdgeFieldDetails {
  node: {
    type: 'Post'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'PostEdge'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post> | prisma.Post
  }
  cursor: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
}

// Types for AggregatePost

type AggregatePostObject =
  | AggregatePostFields
  | { name: 'count'; args?: [] | false; alias?: string }

type AggregatePostFields = 'count'

export interface AggregatePostFieldDetails {
  count: {
    type: 'Int'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
}

// Types for Mutation

type MutationObject =
  | MutationFields
  | {
      name: 'createUser'
      args?: MutationCreateUserArgs[] | false
      alias?: string
    }
  | {
      name: 'updateUser'
      args?: MutationUpdateUserArgs[] | false
      alias?: string
    }
  | {
      name: 'updateManyUsers'
      args?: MutationUpdateManyUsersArgs[] | false
      alias?: string
    }
  | {
      name: 'upsertUser'
      args?: MutationUpsertUserArgs[] | false
      alias?: string
    }
  | {
      name: 'deleteUser'
      args?: MutationDeleteUserArgs[] | false
      alias?: string
    }
  | {
      name: 'deleteManyUsers'
      args?: MutationDeleteManyUsersArgs[] | false
      alias?: string
    }
  | {
      name: 'createPost'
      args?: MutationCreatePostArgs[] | false
      alias?: string
    }
  | {
      name: 'updatePost'
      args?: MutationUpdatePostArgs[] | false
      alias?: string
    }
  | {
      name: 'updateManyPosts'
      args?: MutationUpdateManyPostsArgs[] | false
      alias?: string
    }
  | {
      name: 'upsertPost'
      args?: MutationUpsertPostArgs[] | false
      alias?: string
    }
  | {
      name: 'deletePost'
      args?: MutationDeletePostArgs[] | false
      alias?: string
    }
  | {
      name: 'deleteManyPosts'
      args?: MutationDeleteManyPostsArgs[] | false
      alias?: string
    }

type MutationFields =
  | 'createUser'
  | 'updateUser'
  | 'updateManyUsers'
  | 'upsertUser'
  | 'deleteUser'
  | 'deleteManyUsers'
  | 'createPost'
  | 'updatePost'
  | 'updateManyPosts'
  | 'upsertPost'
  | 'deletePost'
  | 'deleteManyPosts'

type MutationCreateUserArgs = 'data'
type MutationUpdateUserArgs = 'data' | 'where'
type MutationUpdateManyUsersArgs = 'data' | 'where'
type MutationUpsertUserArgs = 'where' | 'create' | 'update'
type MutationDeleteUserArgs = 'where'
type MutationDeleteManyUsersArgs = 'where'
type MutationCreatePostArgs = 'data'
type MutationUpdatePostArgs = 'data' | 'where'
type MutationUpdateManyPostsArgs = 'data' | 'where'
type MutationUpsertPostArgs = 'where' | 'create' | 'update'
type MutationDeletePostArgs = 'where'
type MutationDeleteManyPostsArgs = 'where'

export interface MutationFieldDetails {
  createUser: {
    type: 'User'
    args: Record<MutationCreateUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { data: UserCreateInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User> | prisma.User
  }
  updateUser: {
    type: 'User'
    args: Record<MutationUpdateUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { data: UserUpdateInput; where: UserWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User | null> | prisma.User | null
  }
  updateManyUsers: {
    type: 'BatchPayload'
    args: Record<MutationUpdateManyUsersArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: {
        data: UserUpdateManyMutationInput
        where?: UserWhereInput | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.BatchPayload> | prisma.BatchPayload
  }
  upsertUser: {
    type: 'User'
    args: Record<MutationUpsertUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: {
        where: UserWhereUniqueInput
        create: UserCreateInput
        update: UserUpdateInput
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User> | prisma.User
  }
  deleteUser: {
    type: 'User'
    args: Record<MutationDeleteUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { where: UserWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User | null> | prisma.User | null
  }
  deleteManyUsers: {
    type: 'BatchPayload'
    args: Record<MutationDeleteManyUsersArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { where?: UserWhereInput | null },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.BatchPayload> | prisma.BatchPayload
  }
  createPost: {
    type: 'Post'
    args: Record<MutationCreatePostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { data: PostCreateInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post> | prisma.Post
  }
  updatePost: {
    type: 'Post'
    args: Record<MutationUpdatePostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { data: PostUpdateInput; where: PostWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post | null> | prisma.Post | null
  }
  updateManyPosts: {
    type: 'BatchPayload'
    args: Record<MutationUpdateManyPostsArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: {
        data: PostUpdateManyMutationInput
        where?: PostWhereInput | null
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.BatchPayload> | prisma.BatchPayload
  }
  upsertPost: {
    type: 'Post'
    args: Record<MutationUpsertPostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: {
        where: PostWhereUniqueInput
        create: PostCreateInput
        update: PostUpdateInput
      },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post> | prisma.Post
  }
  deletePost: {
    type: 'Post'
    args: Record<MutationDeletePostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { where: PostWhereUniqueInput },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post | null> | prisma.Post | null
  }
  deleteManyPosts: {
    type: 'BatchPayload'
    args: Record<MutationDeleteManyPostsArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'Mutation'>,
      args: { where?: PostWhereInput | null },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.BatchPayload> | prisma.BatchPayload
  }
}

// Types for BatchPayload

type BatchPayloadObject =
  | BatchPayloadFields
  | { name: 'count'; args?: [] | false; alias?: string }

type BatchPayloadFields = 'count'

export interface BatchPayloadFieldDetails {
  count: {
    type: 'Long'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
}

// Types for Subscription

type SubscriptionObject =
  | SubscriptionFields
  | { name: 'user'; args?: SubscriptionUserArgs[] | false; alias?: string }
  | { name: 'post'; args?: SubscriptionPostArgs[] | false; alias?: string }

type SubscriptionFields = 'user' | 'post'

type SubscriptionUserArgs = 'where'
type SubscriptionPostArgs = 'where'

export interface SubscriptionFieldDetails {
  user: {
    type: 'UserSubscriptionPayload'
    args: Record<SubscriptionUserArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Subscription'>,
      args: { where?: UserSubscriptionWhereInput | null },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) =>
      | Promise<prisma.UserSubscriptionPayload | null>
      | prisma.UserSubscriptionPayload
      | null
  }
  post: {
    type: 'PostSubscriptionPayload'
    args: Record<SubscriptionPostArgs, core.NexusArgDef<string>>
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'Subscription'>,
      args: { where?: PostSubscriptionWhereInput | null },
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) =>
      | Promise<prisma.PostSubscriptionPayload | null>
      | prisma.PostSubscriptionPayload
      | null
  }
}

// Types for UserSubscriptionPayload

type UserSubscriptionPayloadObject =
  | UserSubscriptionPayloadFields
  | { name: 'mutation'; args?: [] | false; alias?: string }
  | { name: 'node'; args?: [] | false; alias?: string }
  | { name: 'updatedFields'; args?: [] | false; alias?: string }
  | { name: 'previousValues'; args?: [] | false; alias?: string }

type UserSubscriptionPayloadFields =
  | 'mutation'
  | 'node'
  | 'updatedFields'
  | 'previousValues'

export interface UserSubscriptionPayloadFieldDetails {
  mutation: {
    type: 'MutationType'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'UserSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.MutationType> | prisma.MutationType
  }
  node: {
    type: 'User'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'UserSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.User | null> | prisma.User | null
  }
  updatedFields: {
    type: 'String'
    args: {}
    description: string
    list: true
    nullable: false
    resolve: undefined
  }
  previousValues: {
    type: 'UserPreviousValues'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'UserSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) =>
      | Promise<prisma.UserPreviousValues | null>
      | prisma.UserPreviousValues
      | null
  }
}

// Types for UserPreviousValues

type UserPreviousValuesObject =
  | UserPreviousValuesFields
  | { name: 'id'; args?: [] | false; alias?: string }
  | { name: 'email'; args?: [] | false; alias?: string }
  | { name: 'name'; args?: [] | false; alias?: string }

type UserPreviousValuesFields = 'id' | 'email' | 'name'

export interface UserPreviousValuesFieldDetails {
  id: {
    type: 'ID'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  email: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  name: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
}

// Types for PostSubscriptionPayload

type PostSubscriptionPayloadObject =
  | PostSubscriptionPayloadFields
  | { name: 'mutation'; args?: [] | false; alias?: string }
  | { name: 'node'; args?: [] | false; alias?: string }
  | { name: 'updatedFields'; args?: [] | false; alias?: string }
  | { name: 'previousValues'; args?: [] | false; alias?: string }

type PostSubscriptionPayloadFields =
  | 'mutation'
  | 'node'
  | 'updatedFields'
  | 'previousValues'

export interface PostSubscriptionPayloadFieldDetails {
  mutation: {
    type: 'MutationType'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: (
      root: core.RootValue<'PostSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.MutationType> | prisma.MutationType
  }
  node: {
    type: 'Post'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'PostSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) => Promise<prisma.Post | null> | prisma.Post | null
  }
  updatedFields: {
    type: 'String'
    args: {}
    description: string
    list: true
    nullable: false
    resolve: undefined
  }
  previousValues: {
    type: 'PostPreviousValues'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: (
      root: core.RootValue<'PostSubscriptionPayload'>,
      args: {},
      context: core.GetGen<'context'>,
      info?: GraphQLResolveInfo,
    ) =>
      | Promise<prisma.PostPreviousValues | null>
      | prisma.PostPreviousValues
      | null
  }
}

// Types for PostPreviousValues

type PostPreviousValuesObject =
  | PostPreviousValuesFields
  | { name: 'id'; args?: [] | false; alias?: string }
  | { name: 'createdAt'; args?: [] | false; alias?: string }
  | { name: 'updatedAt'; args?: [] | false; alias?: string }
  | { name: 'published'; args?: [] | false; alias?: string }
  | { name: 'title'; args?: [] | false; alias?: string }
  | { name: 'content'; args?: [] | false; alias?: string }

type PostPreviousValuesFields =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'published'
  | 'title'
  | 'content'

export interface PostPreviousValuesFieldDetails {
  id: {
    type: 'ID'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  createdAt: {
    type: 'DateTime'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  updatedAt: {
    type: 'DateTime'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  published: {
    type: 'Boolean'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  title: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: false
    resolve: undefined
  }
  content: {
    type: 'String'
    args: {}
    description: string
    list: undefined
    nullable: true
    resolve: undefined
  }
}

export interface UserWhereUniqueInput {
  id?: string | null
  email?: string | null
}
export type UserWhereUniqueInputInputObject =
  | Extract<keyof UserWhereUniqueInput, string>
  | { name: 'id'; alias?: string }
  | { name: 'email'; alias?: string }

export interface PostWhereInput {
  id?: string | null
  id_not?: string | null
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string | null
  id_lte?: string | null
  id_gt?: string | null
  id_gte?: string | null
  id_contains?: string | null
  id_not_contains?: string | null
  id_starts_with?: string | null
  id_not_starts_with?: string | null
  id_ends_with?: string | null
  id_not_ends_with?: string | null
  createdAt?: string | null
  createdAt_not?: string | null
  createdAt_in?: string[]
  createdAt_not_in?: string[]
  createdAt_lt?: string | null
  createdAt_lte?: string | null
  createdAt_gt?: string | null
  createdAt_gte?: string | null
  updatedAt?: string | null
  updatedAt_not?: string | null
  updatedAt_in?: string[]
  updatedAt_not_in?: string[]
  updatedAt_lt?: string | null
  updatedAt_lte?: string | null
  updatedAt_gt?: string | null
  updatedAt_gte?: string | null
  published?: boolean | null
  published_not?: boolean | null
  title?: string | null
  title_not?: string | null
  title_in?: string[]
  title_not_in?: string[]
  title_lt?: string | null
  title_lte?: string | null
  title_gt?: string | null
  title_gte?: string | null
  title_contains?: string | null
  title_not_contains?: string | null
  title_starts_with?: string | null
  title_not_starts_with?: string | null
  title_ends_with?: string | null
  title_not_ends_with?: string | null
  content?: string | null
  content_not?: string | null
  content_in?: string[]
  content_not_in?: string[]
  content_lt?: string | null
  content_lte?: string | null
  content_gt?: string | null
  content_gte?: string | null
  content_contains?: string | null
  content_not_contains?: string | null
  content_starts_with?: string | null
  content_not_starts_with?: string | null
  content_ends_with?: string | null
  content_not_ends_with?: string | null
  author?: UserWhereInput | null
  AND?: PostWhereInput[]
  OR?: PostWhereInput[]
  NOT?: PostWhereInput[]
}
export type PostWhereInputInputObject =
  | Extract<keyof PostWhereInput, string>
  | { name: 'id'; alias?: string }
  | { name: 'id_not'; alias?: string }
  | { name: 'id_in'; alias?: string }
  | { name: 'id_not_in'; alias?: string }
  | { name: 'id_lt'; alias?: string }
  | { name: 'id_lte'; alias?: string }
  | { name: 'id_gt'; alias?: string }
  | { name: 'id_gte'; alias?: string }
  | { name: 'id_contains'; alias?: string }
  | { name: 'id_not_contains'; alias?: string }
  | { name: 'id_starts_with'; alias?: string }
  | { name: 'id_not_starts_with'; alias?: string }
  | { name: 'id_ends_with'; alias?: string }
  | { name: 'id_not_ends_with'; alias?: string }
  | { name: 'createdAt'; alias?: string }
  | { name: 'createdAt_not'; alias?: string }
  | { name: 'createdAt_in'; alias?: string }
  | { name: 'createdAt_not_in'; alias?: string }
  | { name: 'createdAt_lt'; alias?: string }
  | { name: 'createdAt_lte'; alias?: string }
  | { name: 'createdAt_gt'; alias?: string }
  | { name: 'createdAt_gte'; alias?: string }
  | { name: 'updatedAt'; alias?: string }
  | { name: 'updatedAt_not'; alias?: string }
  | { name: 'updatedAt_in'; alias?: string }
  | { name: 'updatedAt_not_in'; alias?: string }
  | { name: 'updatedAt_lt'; alias?: string }
  | { name: 'updatedAt_lte'; alias?: string }
  | { name: 'updatedAt_gt'; alias?: string }
  | { name: 'updatedAt_gte'; alias?: string }
  | { name: 'published'; alias?: string }
  | { name: 'published_not'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'title_not'; alias?: string }
  | { name: 'title_in'; alias?: string }
  | { name: 'title_not_in'; alias?: string }
  | { name: 'title_lt'; alias?: string }
  | { name: 'title_lte'; alias?: string }
  | { name: 'title_gt'; alias?: string }
  | { name: 'title_gte'; alias?: string }
  | { name: 'title_contains'; alias?: string }
  | { name: 'title_not_contains'; alias?: string }
  | { name: 'title_starts_with'; alias?: string }
  | { name: 'title_not_starts_with'; alias?: string }
  | { name: 'title_ends_with'; alias?: string }
  | { name: 'title_not_ends_with'; alias?: string }
  | { name: 'content'; alias?: string }
  | { name: 'content_not'; alias?: string }
  | { name: 'content_in'; alias?: string }
  | { name: 'content_not_in'; alias?: string }
  | { name: 'content_lt'; alias?: string }
  | { name: 'content_lte'; alias?: string }
  | { name: 'content_gt'; alias?: string }
  | { name: 'content_gte'; alias?: string }
  | { name: 'content_contains'; alias?: string }
  | { name: 'content_not_contains'; alias?: string }
  | { name: 'content_starts_with'; alias?: string }
  | { name: 'content_not_starts_with'; alias?: string }
  | { name: 'content_ends_with'; alias?: string }
  | { name: 'content_not_ends_with'; alias?: string }
  | { name: 'author'; alias?: string }
  | { name: 'AND'; alias?: string }
  | { name: 'OR'; alias?: string }
  | { name: 'NOT'; alias?: string }

export interface UserWhereInput {
  id?: string | null
  id_not?: string | null
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string | null
  id_lte?: string | null
  id_gt?: string | null
  id_gte?: string | null
  id_contains?: string | null
  id_not_contains?: string | null
  id_starts_with?: string | null
  id_not_starts_with?: string | null
  id_ends_with?: string | null
  id_not_ends_with?: string | null
  email?: string | null
  email_not?: string | null
  email_in?: string[]
  email_not_in?: string[]
  email_lt?: string | null
  email_lte?: string | null
  email_gt?: string | null
  email_gte?: string | null
  email_contains?: string | null
  email_not_contains?: string | null
  email_starts_with?: string | null
  email_not_starts_with?: string | null
  email_ends_with?: string | null
  email_not_ends_with?: string | null
  name?: string | null
  name_not?: string | null
  name_in?: string[]
  name_not_in?: string[]
  name_lt?: string | null
  name_lte?: string | null
  name_gt?: string | null
  name_gte?: string | null
  name_contains?: string | null
  name_not_contains?: string | null
  name_starts_with?: string | null
  name_not_starts_with?: string | null
  name_ends_with?: string | null
  name_not_ends_with?: string | null
  posts_every?: PostWhereInput | null
  posts_some?: PostWhereInput | null
  posts_none?: PostWhereInput | null
  AND?: UserWhereInput[]
  OR?: UserWhereInput[]
  NOT?: UserWhereInput[]
}
export type UserWhereInputInputObject =
  | Extract<keyof UserWhereInput, string>
  | { name: 'id'; alias?: string }
  | { name: 'id_not'; alias?: string }
  | { name: 'id_in'; alias?: string }
  | { name: 'id_not_in'; alias?: string }
  | { name: 'id_lt'; alias?: string }
  | { name: 'id_lte'; alias?: string }
  | { name: 'id_gt'; alias?: string }
  | { name: 'id_gte'; alias?: string }
  | { name: 'id_contains'; alias?: string }
  | { name: 'id_not_contains'; alias?: string }
  | { name: 'id_starts_with'; alias?: string }
  | { name: 'id_not_starts_with'; alias?: string }
  | { name: 'id_ends_with'; alias?: string }
  | { name: 'id_not_ends_with'; alias?: string }
  | { name: 'email'; alias?: string }
  | { name: 'email_not'; alias?: string }
  | { name: 'email_in'; alias?: string }
  | { name: 'email_not_in'; alias?: string }
  | { name: 'email_lt'; alias?: string }
  | { name: 'email_lte'; alias?: string }
  | { name: 'email_gt'; alias?: string }
  | { name: 'email_gte'; alias?: string }
  | { name: 'email_contains'; alias?: string }
  | { name: 'email_not_contains'; alias?: string }
  | { name: 'email_starts_with'; alias?: string }
  | { name: 'email_not_starts_with'; alias?: string }
  | { name: 'email_ends_with'; alias?: string }
  | { name: 'email_not_ends_with'; alias?: string }
  | { name: 'name'; alias?: string }
  | { name: 'name_not'; alias?: string }
  | { name: 'name_in'; alias?: string }
  | { name: 'name_not_in'; alias?: string }
  | { name: 'name_lt'; alias?: string }
  | { name: 'name_lte'; alias?: string }
  | { name: 'name_gt'; alias?: string }
  | { name: 'name_gte'; alias?: string }
  | { name: 'name_contains'; alias?: string }
  | { name: 'name_not_contains'; alias?: string }
  | { name: 'name_starts_with'; alias?: string }
  | { name: 'name_not_starts_with'; alias?: string }
  | { name: 'name_ends_with'; alias?: string }
  | { name: 'name_not_ends_with'; alias?: string }
  | { name: 'posts_every'; alias?: string }
  | { name: 'posts_some'; alias?: string }
  | { name: 'posts_none'; alias?: string }
  | { name: 'AND'; alias?: string }
  | { name: 'OR'; alias?: string }
  | { name: 'NOT'; alias?: string }

export interface PostWhereUniqueInput {
  id?: string | null
}
export type PostWhereUniqueInputInputObject =
  | Extract<keyof PostWhereUniqueInput, string>
  | { name: 'id'; alias?: string }

export interface UserCreateInput {
  email?: string
  name?: string | null
  posts?: PostCreateManyWithoutAuthorInput | null
}
export type UserCreateInputInputObject =
  | Extract<keyof UserCreateInput, string>
  | { name: 'email'; alias?: string }
  | { name: 'name'; alias?: string }
  | { name: 'posts'; alias?: string }

export interface PostCreateManyWithoutAuthorInput {
  create?: PostCreateWithoutAuthorInput[]
  connect?: PostWhereUniqueInput[]
}
export type PostCreateManyWithoutAuthorInputInputObject =
  | Extract<keyof PostCreateManyWithoutAuthorInput, string>
  | { name: 'create'; alias?: string }
  | { name: 'connect'; alias?: string }

export interface PostCreateWithoutAuthorInput {
  published?: boolean | null
  title?: string
  content?: string | null
}
export type PostCreateWithoutAuthorInputInputObject =
  | Extract<keyof PostCreateWithoutAuthorInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }

export interface UserUpdateInput {
  email?: string | null
  name?: string | null
  posts?: PostUpdateManyWithoutAuthorInput | null
}
export type UserUpdateInputInputObject =
  | Extract<keyof UserUpdateInput, string>
  | { name: 'email'; alias?: string }
  | { name: 'name'; alias?: string }
  | { name: 'posts'; alias?: string }

export interface PostUpdateManyWithoutAuthorInput {
  create?: PostCreateWithoutAuthorInput[]
  delete?: PostWhereUniqueInput[]
  connect?: PostWhereUniqueInput[]
  set?: PostWhereUniqueInput[]
  disconnect?: PostWhereUniqueInput[]
  update?: PostUpdateWithWhereUniqueWithoutAuthorInput[]
  upsert?: PostUpsertWithWhereUniqueWithoutAuthorInput[]
  deleteMany?: PostScalarWhereInput[]
  updateMany?: PostUpdateManyWithWhereNestedInput[]
}
export type PostUpdateManyWithoutAuthorInputInputObject =
  | Extract<keyof PostUpdateManyWithoutAuthorInput, string>
  | { name: 'create'; alias?: string }
  | { name: 'delete'; alias?: string }
  | { name: 'connect'; alias?: string }
  | { name: 'set'; alias?: string }
  | { name: 'disconnect'; alias?: string }
  | { name: 'update'; alias?: string }
  | { name: 'upsert'; alias?: string }
  | { name: 'deleteMany'; alias?: string }
  | { name: 'updateMany'; alias?: string }

export interface PostUpdateWithWhereUniqueWithoutAuthorInput {
  where?: PostWhereUniqueInput
  data?: PostUpdateWithoutAuthorDataInput
}
export type PostUpdateWithWhereUniqueWithoutAuthorInputInputObject =
  | Extract<keyof PostUpdateWithWhereUniqueWithoutAuthorInput, string>
  | { name: 'where'; alias?: string }
  | { name: 'data'; alias?: string }

export interface PostUpdateWithoutAuthorDataInput {
  published?: boolean | null
  title?: string | null
  content?: string | null
}
export type PostUpdateWithoutAuthorDataInputInputObject =
  | Extract<keyof PostUpdateWithoutAuthorDataInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }

export interface PostUpsertWithWhereUniqueWithoutAuthorInput {
  where?: PostWhereUniqueInput
  update?: PostUpdateWithoutAuthorDataInput
  create?: PostCreateWithoutAuthorInput
}
export type PostUpsertWithWhereUniqueWithoutAuthorInputInputObject =
  | Extract<keyof PostUpsertWithWhereUniqueWithoutAuthorInput, string>
  | { name: 'where'; alias?: string }
  | { name: 'update'; alias?: string }
  | { name: 'create'; alias?: string }

export interface PostScalarWhereInput {
  id?: string | null
  id_not?: string | null
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string | null
  id_lte?: string | null
  id_gt?: string | null
  id_gte?: string | null
  id_contains?: string | null
  id_not_contains?: string | null
  id_starts_with?: string | null
  id_not_starts_with?: string | null
  id_ends_with?: string | null
  id_not_ends_with?: string | null
  createdAt?: string | null
  createdAt_not?: string | null
  createdAt_in?: string[]
  createdAt_not_in?: string[]
  createdAt_lt?: string | null
  createdAt_lte?: string | null
  createdAt_gt?: string | null
  createdAt_gte?: string | null
  updatedAt?: string | null
  updatedAt_not?: string | null
  updatedAt_in?: string[]
  updatedAt_not_in?: string[]
  updatedAt_lt?: string | null
  updatedAt_lte?: string | null
  updatedAt_gt?: string | null
  updatedAt_gte?: string | null
  published?: boolean | null
  published_not?: boolean | null
  title?: string | null
  title_not?: string | null
  title_in?: string[]
  title_not_in?: string[]
  title_lt?: string | null
  title_lte?: string | null
  title_gt?: string | null
  title_gte?: string | null
  title_contains?: string | null
  title_not_contains?: string | null
  title_starts_with?: string | null
  title_not_starts_with?: string | null
  title_ends_with?: string | null
  title_not_ends_with?: string | null
  content?: string | null
  content_not?: string | null
  content_in?: string[]
  content_not_in?: string[]
  content_lt?: string | null
  content_lte?: string | null
  content_gt?: string | null
  content_gte?: string | null
  content_contains?: string | null
  content_not_contains?: string | null
  content_starts_with?: string | null
  content_not_starts_with?: string | null
  content_ends_with?: string | null
  content_not_ends_with?: string | null
  AND?: PostScalarWhereInput[]
  OR?: PostScalarWhereInput[]
  NOT?: PostScalarWhereInput[]
}
export type PostScalarWhereInputInputObject =
  | Extract<keyof PostScalarWhereInput, string>
  | { name: 'id'; alias?: string }
  | { name: 'id_not'; alias?: string }
  | { name: 'id_in'; alias?: string }
  | { name: 'id_not_in'; alias?: string }
  | { name: 'id_lt'; alias?: string }
  | { name: 'id_lte'; alias?: string }
  | { name: 'id_gt'; alias?: string }
  | { name: 'id_gte'; alias?: string }
  | { name: 'id_contains'; alias?: string }
  | { name: 'id_not_contains'; alias?: string }
  | { name: 'id_starts_with'; alias?: string }
  | { name: 'id_not_starts_with'; alias?: string }
  | { name: 'id_ends_with'; alias?: string }
  | { name: 'id_not_ends_with'; alias?: string }
  | { name: 'createdAt'; alias?: string }
  | { name: 'createdAt_not'; alias?: string }
  | { name: 'createdAt_in'; alias?: string }
  | { name: 'createdAt_not_in'; alias?: string }
  | { name: 'createdAt_lt'; alias?: string }
  | { name: 'createdAt_lte'; alias?: string }
  | { name: 'createdAt_gt'; alias?: string }
  | { name: 'createdAt_gte'; alias?: string }
  | { name: 'updatedAt'; alias?: string }
  | { name: 'updatedAt_not'; alias?: string }
  | { name: 'updatedAt_in'; alias?: string }
  | { name: 'updatedAt_not_in'; alias?: string }
  | { name: 'updatedAt_lt'; alias?: string }
  | { name: 'updatedAt_lte'; alias?: string }
  | { name: 'updatedAt_gt'; alias?: string }
  | { name: 'updatedAt_gte'; alias?: string }
  | { name: 'published'; alias?: string }
  | { name: 'published_not'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'title_not'; alias?: string }
  | { name: 'title_in'; alias?: string }
  | { name: 'title_not_in'; alias?: string }
  | { name: 'title_lt'; alias?: string }
  | { name: 'title_lte'; alias?: string }
  | { name: 'title_gt'; alias?: string }
  | { name: 'title_gte'; alias?: string }
  | { name: 'title_contains'; alias?: string }
  | { name: 'title_not_contains'; alias?: string }
  | { name: 'title_starts_with'; alias?: string }
  | { name: 'title_not_starts_with'; alias?: string }
  | { name: 'title_ends_with'; alias?: string }
  | { name: 'title_not_ends_with'; alias?: string }
  | { name: 'content'; alias?: string }
  | { name: 'content_not'; alias?: string }
  | { name: 'content_in'; alias?: string }
  | { name: 'content_not_in'; alias?: string }
  | { name: 'content_lt'; alias?: string }
  | { name: 'content_lte'; alias?: string }
  | { name: 'content_gt'; alias?: string }
  | { name: 'content_gte'; alias?: string }
  | { name: 'content_contains'; alias?: string }
  | { name: 'content_not_contains'; alias?: string }
  | { name: 'content_starts_with'; alias?: string }
  | { name: 'content_not_starts_with'; alias?: string }
  | { name: 'content_ends_with'; alias?: string }
  | { name: 'content_not_ends_with'; alias?: string }
  | { name: 'AND'; alias?: string }
  | { name: 'OR'; alias?: string }
  | { name: 'NOT'; alias?: string }

export interface PostUpdateManyWithWhereNestedInput {
  where?: PostScalarWhereInput
  data?: PostUpdateManyDataInput
}
export type PostUpdateManyWithWhereNestedInputInputObject =
  | Extract<keyof PostUpdateManyWithWhereNestedInput, string>
  | { name: 'where'; alias?: string }
  | { name: 'data'; alias?: string }

export interface PostUpdateManyDataInput {
  published?: boolean | null
  title?: string | null
  content?: string | null
}
export type PostUpdateManyDataInputInputObject =
  | Extract<keyof PostUpdateManyDataInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }

export interface UserUpdateManyMutationInput {
  email?: string | null
  name?: string | null
}
export type UserUpdateManyMutationInputInputObject =
  | Extract<keyof UserUpdateManyMutationInput, string>
  | { name: 'email'; alias?: string }
  | { name: 'name'; alias?: string }

export interface PostCreateInput {
  published?: boolean | null
  title?: string
  content?: string | null
  author?: UserCreateOneWithoutPostsInput
}
export type PostCreateInputInputObject =
  | Extract<keyof PostCreateInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }
  | { name: 'author'; alias?: string }

export interface UserCreateOneWithoutPostsInput {
  create?: UserCreateWithoutPostsInput | null
  connect?: UserWhereUniqueInput | null
}
export type UserCreateOneWithoutPostsInputInputObject =
  | Extract<keyof UserCreateOneWithoutPostsInput, string>
  | { name: 'create'; alias?: string }
  | { name: 'connect'; alias?: string }

export interface UserCreateWithoutPostsInput {
  email?: string
  name?: string | null
}
export type UserCreateWithoutPostsInputInputObject =
  | Extract<keyof UserCreateWithoutPostsInput, string>
  | { name: 'email'; alias?: string }
  | { name: 'name'; alias?: string }

export interface PostUpdateInput {
  published?: boolean | null
  title?: string | null
  content?: string | null
  author?: UserUpdateOneRequiredWithoutPostsInput | null
}
export type PostUpdateInputInputObject =
  | Extract<keyof PostUpdateInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }
  | { name: 'author'; alias?: string }

export interface UserUpdateOneRequiredWithoutPostsInput {
  create?: UserCreateWithoutPostsInput | null
  update?: UserUpdateWithoutPostsDataInput | null
  upsert?: UserUpsertWithoutPostsInput | null
  connect?: UserWhereUniqueInput | null
}
export type UserUpdateOneRequiredWithoutPostsInputInputObject =
  | Extract<keyof UserUpdateOneRequiredWithoutPostsInput, string>
  | { name: 'create'; alias?: string }
  | { name: 'update'; alias?: string }
  | { name: 'upsert'; alias?: string }
  | { name: 'connect'; alias?: string }

export interface UserUpdateWithoutPostsDataInput {
  email?: string | null
  name?: string | null
}
export type UserUpdateWithoutPostsDataInputInputObject =
  | Extract<keyof UserUpdateWithoutPostsDataInput, string>
  | { name: 'email'; alias?: string }
  | { name: 'name'; alias?: string }

export interface UserUpsertWithoutPostsInput {
  update?: UserUpdateWithoutPostsDataInput
  create?: UserCreateWithoutPostsInput
}
export type UserUpsertWithoutPostsInputInputObject =
  | Extract<keyof UserUpsertWithoutPostsInput, string>
  | { name: 'update'; alias?: string }
  | { name: 'create'; alias?: string }

export interface PostUpdateManyMutationInput {
  published?: boolean | null
  title?: string | null
  content?: string | null
}
export type PostUpdateManyMutationInputInputObject =
  | Extract<keyof PostUpdateManyMutationInput, string>
  | { name: 'published'; alias?: string }
  | { name: 'title'; alias?: string }
  | { name: 'content'; alias?: string }

export interface UserSubscriptionWhereInput {
  mutation_in?: prisma.MutationType[]
  updatedFields_contains?: string | null
  updatedFields_contains_every?: string[]
  updatedFields_contains_some?: string[]
  node?: UserWhereInput | null
  AND?: UserSubscriptionWhereInput[]
  OR?: UserSubscriptionWhereInput[]
  NOT?: UserSubscriptionWhereInput[]
}
export type UserSubscriptionWhereInputInputObject =
  | Extract<keyof UserSubscriptionWhereInput, string>
  | { name: 'mutation_in'; alias?: string }
  | { name: 'updatedFields_contains'; alias?: string }
  | { name: 'updatedFields_contains_every'; alias?: string }
  | { name: 'updatedFields_contains_some'; alias?: string }
  | { name: 'node'; alias?: string }
  | { name: 'AND'; alias?: string }
  | { name: 'OR'; alias?: string }
  | { name: 'NOT'; alias?: string }

export interface PostSubscriptionWhereInput {
  mutation_in?: prisma.MutationType[]
  updatedFields_contains?: string | null
  updatedFields_contains_every?: string[]
  updatedFields_contains_some?: string[]
  node?: PostWhereInput | null
  AND?: PostSubscriptionWhereInput[]
  OR?: PostSubscriptionWhereInput[]
  NOT?: PostSubscriptionWhereInput[]
}
export type PostSubscriptionWhereInputInputObject =
  | Extract<keyof PostSubscriptionWhereInput, string>
  | { name: 'mutation_in'; alias?: string }
  | { name: 'updatedFields_contains'; alias?: string }
  | { name: 'updatedFields_contains_every'; alias?: string }
  | { name: 'updatedFields_contains_some'; alias?: string }
  | { name: 'node'; alias?: string }
  | { name: 'AND'; alias?: string }
  | { name: 'OR'; alias?: string }
  | { name: 'NOT'; alias?: string }

export type PostOrderByInputValues =
  | 'id_ASC'
  | 'id_DESC'
  | 'createdAt_ASC'
  | 'createdAt_DESC'
  | 'updatedAt_ASC'
  | 'updatedAt_DESC'
  | 'published_ASC'
  | 'published_DESC'
  | 'title_ASC'
  | 'title_DESC'
  | 'content_ASC'
  | 'content_DESC'

export type UserOrderByInputValues =
  | 'id_ASC'
  | 'id_DESC'
  | 'email_ASC'
  | 'email_DESC'
  | 'name_ASC'
  | 'name_DESC'
  | 'createdAt_ASC'
  | 'createdAt_DESC'
  | 'updatedAt_ASC'
  | 'updatedAt_DESC'

export type MutationTypeValues = 'CREATED' | 'UPDATED' | 'DELETED'
