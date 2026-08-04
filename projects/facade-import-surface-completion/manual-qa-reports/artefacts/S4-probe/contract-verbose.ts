import mongoFamily from '@internal/family-mongo/pack';
import { defineContract, field, model } from '@internal/mongo-contract-ts/contract-builder';
import mongoTarget from '@internal/target-mongo/pack';

export const contract = defineContract({
  family: mongoFamily,
  target: mongoTarget,
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
