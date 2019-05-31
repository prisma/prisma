import { DatabaseStep } from './types'

export const exampleDbSteps: DatabaseStep[] = [
  {
    RawSql: 'PRAGMA foreign_keys=OFF;',
    raw: '',
  },
  {
    CreateTable: {
      name: 'new_Post',
      columns: [
        {
          name: 'id',
          tpe: 'Int',
          required: true,
          foreign_key: null,
          raw: '',
        },
        {
          name: 'title',
          tpe: 'String',
          required: true,
          foreign_key: null,
          raw: '',
        },
        {
          name: 'anotherText',
          tpe: 'String',
          required: true,
          foreign_key: null,
          raw: '',
        },
        {
          name: 'text',
          tpe: 'String',
          required: true,
          foreign_key: null,
          raw: '',
        },
        {
          name: 'blog',
          tpe: 'Int',
          required: true,
          foreign_key: {
            table: 'Blog',
            column: 'id',
          },
          raw: '',
        },
      ],
      primary_columns: ['id'],
    },
    raw: '',
  },
  {
    raw: '',
    RawSql:
      'INSERT INTO new_Post (id,title,text,blog) SELECT id,title,text,blog from Post',
  },
  {
    raw: '',
    DropTable: {
      name: 'Post',
    },
  },
  {
    raw: '',
    RenameTable: {
      name: 'new_Post',
      new_name: 'Post',
    },
  },
  {
    raw: '',
    RawSql: 'PRAGMA "migration_engine".foreign_key_check;',
  },
  {
    raw: '',
    RawSql: 'PRAGMA foreign_keys=ON;',
  },
]
