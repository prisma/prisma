import { textColumn } from '@internal/adapter-postgres/column-types';
import { defineContract, field, model } from '@internal/postgres/contract-builder';

export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field.column(textColumn).defaultSql('gen_random_uuid()').id(),
      },
    }).sql({ table: 'user' }),
  },
});
