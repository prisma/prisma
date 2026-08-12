import { uuidv7 } from '@internal/ids';
import { defineContract, field, model } from '@internal/postgres/contract-builder';

export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field.generated(uuidv7()).id(),
      },
    }).sql({ table: 'user' }),
  },
});
