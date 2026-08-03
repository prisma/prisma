import { nanoid } from '@internal/ids';
import { defineContract, field, model } from '@internal/postgres/contract-builder';

export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field.generated(nanoid()).id(),
      },
    }).sql({ table: 'user' }),
  },
});
