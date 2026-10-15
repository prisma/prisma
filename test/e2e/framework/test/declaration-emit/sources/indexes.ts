import { textColumn } from '@prisma/orm-postgres/adapter/column-types';
import { defineContract, fullTextIndex } from '@prisma/orm-postgres/contract-builder';

export const indexed = defineContract({}, ({ field, model }) => {
  const Author = model('Author', { fields: { id: field.id.uuidv4String() } });
  const Note = model('Note', {
    fields: {
      id: field.id.uuidv4String(),
      authorId: field.uuidString(),
      title: field.column(textColumn),
      body: field.column(textColumn),
    },
  });
  return {
    models: {
      Author: Author.sql({ table: 'author' }),
      Note: Note.sql(({ cols, constraints }) => ({
        table: 'note',
        indexes: [
          constraints.index([cols.title]),
          constraints.index([cols.body], { map: 'note_body_exact' }),
          fullTextIndex([[cols.title], cols.body], { name: 'note_search', language: 'german' }),
        ],
        foreignKeys: [constraints.foreignKey(cols.authorId, Author.refs.id)],
      })),
    },
  };
});
