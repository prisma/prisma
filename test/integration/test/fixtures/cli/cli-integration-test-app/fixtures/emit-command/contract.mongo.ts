import { defineContract, field, index, model, rel } from '@internal/mongo/contract-builder';

const User = model('User', {
  collection: 'users',
  fields: {
    _id: field.objectId(),
    email: field.string(),
  },
  indexes: [index({ email: 1 }, { unique: true })],
  collectionOptions: {
    collation: { locale: 'en', strength: 2 },
  },
});

const Task = model('Task', {
  collection: 'tasks',
  storageRelations: {
    comments: { field: 'comments' },
  },
  fields: {
    _id: field.objectId(),
    type: field.string(),
    title: field.string(),
    assigneeId: field.objectId(),
  },
  relations: {
    assignee: rel.belongsTo(User, {
      from: 'assigneeId',
      to: User.ref('_id'),
    }),
    comments: rel.hasMany('Comment'),
  },
  discriminator: {
    field: 'type',
    variants: {
      Bug: { value: 'bug' },
    },
  },
});

const Bug = model('Bug', {
  collection: 'tasks',
  base: Task,
  fields: {
    severity: field.string(),
  },
});

const Comment = model('Comment', {
  owner: Task,
  fields: {
    _id: field.objectId(),
    text: field.string(),
  },
});

export const contract = defineContract({
  models: {
    Task,
    Bug,
    User,
    Comment,
  },
});
