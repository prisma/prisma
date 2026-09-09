import type { ResultType } from '@internal/framework-components/runtime';
import type { Scalars, With } from '@internal/sql-contract/types';
import { expectTypeOf, test } from 'vitest';
import type {
  Contract as PolyContract,
  Models as PolyModels,
} from '../../../../test/integration/test/sql-orm-client/fixtures/polymorphism/generated/contract';
import type { Collection } from '../src/collection';
import type { DefaultModelRow, VariantModelRow } from '../src/types';
import type { Contract, Models } from './fixtures/generated/contract';

declare const db: {
  Article: Collection<Contract, 'Article'>;
  Comment: Collection<Contract, 'Comment'>;
  Post: Collection<Contract, 'Post'>;
  Profile: Collection<Contract, 'Profile'>;
  Project: Collection<Contract, 'Project'>;
  ProjectLink: Collection<Contract, 'ProjectLink'>;
  Role: Collection<Contract, 'Role'>;
  Tag: Collection<Contract, 'Tag'>;
  User: Collection<Contract, 'User'>;
  UserRole: Collection<Contract, 'UserRole'>;
  UserTag: Collection<Contract, 'UserTag'>;
};

declare const poly: {
  Account: Collection<PolyContract, 'Account'>;
  Person: Collection<PolyContract, 'Person'>;
  Project: Collection<PolyContract, 'Project'>;
  Task: Collection<PolyContract, 'Task'>;
  TaskComment: Collection<PolyContract, 'TaskComment'>;
  Ticket: Collection<PolyContract, 'Ticket'>;
  User: Collection<PolyContract, 'User'>;
};

test('DefaultModelRow equals Scalars of the emitted model for every non-polymorphic model', () => {
  expectTypeOf<DefaultModelRow<Contract, 'Article'>>().toEqualTypeOf<
    Scalars<Models.public_Article>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'Comment'>>().toEqualTypeOf<
    Scalars<Models.public_Comment>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'Post'>>().toEqualTypeOf<Scalars<Models.public_Post>>();
  expectTypeOf<DefaultModelRow<Contract, 'Profile'>>().toEqualTypeOf<
    Scalars<Models.public_Profile>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'Project'>>().toEqualTypeOf<
    Scalars<Models.public_Project>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'ProjectLink'>>().toEqualTypeOf<
    Scalars<Models.public_ProjectLink>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'Role'>>().toEqualTypeOf<Scalars<Models.public_Role>>();
  expectTypeOf<DefaultModelRow<Contract, 'Tag'>>().toEqualTypeOf<Scalars<Models.public_Tag>>();
  expectTypeOf<DefaultModelRow<Contract, 'User'>>().toEqualTypeOf<Scalars<Models.public_User>>();
  expectTypeOf<DefaultModelRow<Contract, 'UserRole'>>().toEqualTypeOf<
    Scalars<Models.public_UserRole>
  >();
  expectTypeOf<DefaultModelRow<Contract, 'UserTag'>>().toEqualTypeOf<
    Scalars<Models.public_UserTag>
  >();

  expectTypeOf<DefaultModelRow<PolyContract, 'Account'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Account>
  >();
  expectTypeOf<DefaultModelRow<PolyContract, 'Person'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Person>
  >();
  expectTypeOf<DefaultModelRow<PolyContract, 'Project'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Project>
  >();
  expectTypeOf<DefaultModelRow<PolyContract, 'TaskComment'>>().toEqualTypeOf<
    Scalars<PolyModels.public_TaskComment>
  >();
  expectTypeOf<DefaultModelRow<PolyContract, 'Ticket'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Ticket>
  >();
});

test('VariantModelRow equals Scalars of the emitted variant member', () => {
  expectTypeOf<VariantModelRow<PolyContract, 'Task', 'Bug'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Bug>
  >();
  expectTypeOf<VariantModelRow<PolyContract, 'Task', 'Feature'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Feature>
  >();
  expectTypeOf<VariantModelRow<PolyContract, 'Task', 'Epic'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Epic>
  >();
  expectTypeOf<VariantModelRow<PolyContract, 'User', 'Admin'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Admin>
  >();
  expectTypeOf<VariantModelRow<PolyContract, 'User', 'Regular'>>().toEqualTypeOf<
    Scalars<PolyModels.public_Regular>
  >();
});

test('ResultType of a root collection equals Scalars of the emitted model and is not never', () => {
  expectTypeOf<ResultType<typeof db.Article>>().toEqualTypeOf<Scalars<Models.public_Article>>();
  expectTypeOf<ResultType<typeof db.Comment>>().toEqualTypeOf<Scalars<Models.public_Comment>>();
  expectTypeOf<ResultType<typeof db.Post>>().toEqualTypeOf<Scalars<Models.public_Post>>();
  expectTypeOf<ResultType<typeof db.Profile>>().toEqualTypeOf<Scalars<Models.public_Profile>>();
  expectTypeOf<ResultType<typeof db.Project>>().toEqualTypeOf<Scalars<Models.public_Project>>();
  expectTypeOf<ResultType<typeof db.ProjectLink>>().toEqualTypeOf<
    Scalars<Models.public_ProjectLink>
  >();
  expectTypeOf<ResultType<typeof db.Role>>().toEqualTypeOf<Scalars<Models.public_Role>>();
  expectTypeOf<ResultType<typeof db.Tag>>().toEqualTypeOf<Scalars<Models.public_Tag>>();
  expectTypeOf<ResultType<typeof db.User>>().toEqualTypeOf<Scalars<Models.public_User>>();
  expectTypeOf<ResultType<typeof db.UserRole>>().toEqualTypeOf<Scalars<Models.public_UserRole>>();
  expectTypeOf<ResultType<typeof db.UserTag>>().toEqualTypeOf<Scalars<Models.public_UserTag>>();
  expectTypeOf<ResultType<typeof db.User>>().not.toBeNever();

  expectTypeOf<ResultType<typeof poly.Account>>().toEqualTypeOf<
    Scalars<PolyModels.public_Account>
  >();
  expectTypeOf<ResultType<typeof poly.Person>>().toEqualTypeOf<Scalars<PolyModels.public_Person>>();
  expectTypeOf<ResultType<typeof poly.Project>>().toEqualTypeOf<
    Scalars<PolyModels.public_Project>
  >();
  expectTypeOf<ResultType<typeof poly.TaskComment>>().toEqualTypeOf<
    Scalars<PolyModels.public_TaskComment>
  >();
  expectTypeOf<ResultType<typeof poly.Ticket>>().toEqualTypeOf<Scalars<PolyModels.public_Ticket>>();
});

test('ResultType of a to-one include equals With', () => {
  const withAuthor = db.Post.include('author');
  expectTypeOf<ResultType<typeof withAuthor>>().toEqualTypeOf<With<Models.public_Post, 'author'>>();
});

test('ResultType of a to-many include equals With', () => {
  const withComments = db.Post.include('comments');
  expectTypeOf<ResultType<typeof withComments>>().toEqualTypeOf<
    With<Models.public_Post, 'comments'>
  >();
});

test('With is the hand-written Scalars intersection, flattened into one object', () => {
  type PostWithComments = Scalars<Models.public_Post> & {
    comments: Scalars<Models.public_Comment>[];
  };
  expectTypeOf<With<Models.public_Post, 'comments'>>().toMatchTypeOf<PostWithComments>();
  expectTypeOf<PostWithComments>().toMatchTypeOf<With<Models.public_Post, 'comments'>>();
  expectTypeOf<With<Models.public_Post, 'comments'>>().toEqualTypeOf<{
    [K in keyof PostWithComments]: PostWithComments[K];
  }>();
});

test('ResultType of a nullable to-one include equals With', () => {
  const withInviter = db.User.include('invitedBy');
  expectTypeOf<ResultType<typeof withInviter>>().toEqualTypeOf<
    With<Models.public_User, 'invitedBy'>
  >();
});

test('ResultType of a to-one include on a required field equals With and is not nullable', () => {
  const withReviewer = db.Article.include('reviewer');
  expectTypeOf<ResultType<typeof withReviewer>>().toEqualTypeOf<
    With<Models.public_Article, 'reviewer'>
  >();
  expectTypeOf<Models.public_Article['reviewer']>().toEqualTypeOf<Models.public_User>();
});

test('ResultType of a select projection is the projected shape', () => {
  const projected = db.User.select('id');
  expectTypeOf<ResultType<typeof projected>>().toEqualTypeOf<{ id: number }>();
});

test('a refined to-one include is nullable even when the relation is not', () => {
  const refined = db.Article.include('reviewer', (reviewer) => reviewer.where({ id: 1 }));
  expectTypeOf<
    ResultType<typeof refined>['reviewer']
  >().toEqualTypeOf<Scalars<Models.public_User> | null>();
});

test('ResultType of a refined include is not never', () => {
  const refined = db.User.include('posts', (posts) => posts.select('id'));
  expectTypeOf<ResultType<typeof refined>>().not.toBeNever();
});

test('polymorphic base discriminator is the union of variant literals', () => {
  expectTypeOf<PolyModels.public_Task['type']>().toEqualTypeOf<'bug' | 'feature' | 'epic'>();
});

test('ResultType of a variant collection equals Scalars of the variant member', () => {
  const bugs = poly.Task.variant('Bug');
  expectTypeOf<ResultType<typeof bugs>>().toEqualTypeOf<Scalars<PolyModels.public_Bug>>();
});

test('ResultType of a polymorphic base collection equals Scalars of the Any union', () => {
  expectTypeOf<ResultType<typeof poly.Task>>().toEqualTypeOf<Scalars<PolyModels.public_AnyTask>>();
  expectTypeOf<ResultType<typeof poly.User>>().toEqualTypeOf<Scalars<PolyModels.public_AnyUser>>();
});

test('ResultType of an include whose target is a polymorphic base equals With over the Any union', () => {
  const projectsWithTasks = poly.Project.include('tasks');
  expectTypeOf<ResultType<typeof projectsWithTasks>>().toEqualTypeOf<
    With<PolyModels.public_Project, 'tasks'>
  >();
  const commentsWithTask = poly.TaskComment.include('task');
  expectTypeOf<ResultType<typeof commentsWithTask>>().toEqualTypeOf<
    With<PolyModels.public_TaskComment, 'task'>
  >();
});

test('With rejects a name that is not a relation', () => {
  // @ts-expect-error 'nope' is not a relation of User
  type Bad = With<Models.public_User, 'nope'>;
  expectTypeOf<Bad>().not.toBeNever();
});
