import { uuidv4 } from '@internal/ids';
import { defineContract, field, model } from '@internal/postgres/contract-builder';

export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field.generated(uuidv4()).id(),
      },
    }).sql({ table: 'user' }),
  },
});
