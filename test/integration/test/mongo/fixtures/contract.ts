// Intentionally uses verbose mongo-contract-ts import: the mongo facade's defineContract
// has a type inference regression for discriminated union contracts with embedded relations
// (the intersection-based return type loses type precision compared to the base overload).
// Tracked at https://linear.app/prisma-company/issue/TML-2633 — migrate to the facade form
// once TML-2633 lands.
import mongoFamily from '@internal/family-mongo/pack';
import {
  defineContract,
  field,
  index,
  model,
  rel,
} from '@internal/mongo-contract-ts/contract-builder';
import mongoTarget from '@internal/target-mongo/pack';

const User = model('User', {
  collection: 'users',
  storageRelations: {
    addresses: { field: 'addresses' },
  },
  fields: {
    _id: field.objectId(),
    name: field.string(),
    email: field.string(),
  },
  indexes: [index({ email: 1 }, { unique: true })],
  collectionOptions: {
    collation: { locale: 'en', strength: 2 },
  },
  relations: {
    addresses: rel.hasMany('Address'),
  },
});

const Task = model('Task', {
  collection: 'tasks',
  storageRelations: {
    comments: { field: 'comments' },
  },
  fields: {
    _id: field.objectId(),
    title: field.string(),
    type: field.string(),
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
      Feature: { value: 'feature' },
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

const Feature = model('Feature', {
  collection: 'tasks',
  base: Task,
  fields: {
    priority: field.string(),
    targetRelease: field.string(),
  },
});

const Address = model('Address', {
  owner: User,
  fields: {
    street: field.string(),
    city: field.string(),
    zip: field.string(),
  },
});

const Comment = model('Comment', {
  owner: Task,
  fields: {
    _id: field.objectId(),
    text: field.string(),
    createdAt: field.date(),
  },
});

export const contract = defineContract({
  family: mongoFamily,
  target: mongoTarget,
  models: {
    Task,
    Bug,
    Feature,
    User,
    Address,
    Comment,
  },
});
