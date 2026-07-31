import { defineContract, field, model } from '@internal/mongo/contract-builder';

export const contract = defineContract({
  models: {
    Order: model('Order', {
      collection: 'orders',
      fields: {
        _id: field.objectId(),
        amount: field.double(),
        status: field.string(),
      },
    }),
  },
});
