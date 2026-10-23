import { defineContract } from '@internal/mongo/contract-builder';

export const contract = defineContract({}, ({ field, gen, model }) => ({
  models: {
    Post: model('Post', {
      collection: 'posts',
      fields: {
        id: field.objectId().mongo({ field: '_id' }),
        title: field.string().mongo({ field: 't' }),
        createdAt: field.temporal.createdAt(),
        updatedAt: field.temporal.updatedAt().mongo({ field: 'updated_at' }),
        seenAt: field.date().onCreate(gen.now()),
        touchedAt: field.date().onUpdate(gen.now()),
        stamp: field.temporal.timestamp(),
      },
    }),
  },
}));
