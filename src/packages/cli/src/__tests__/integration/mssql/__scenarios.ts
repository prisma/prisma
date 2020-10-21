import { Input } from '../../__helpers__/integrationTest'

export const scenarios = [
  {
    name: 'findOne where PK',
    up: `
      create table [teams] (
          id int primary key not null,
          name nvarchar(50) not null unique
      );
      insert into [teams] (id, name) values (1, 'a');
      insert into [teams] (id, name) values (2, 'b');
    `,
    do: async client => client.teams.findOne({ where: { id: 2 } }),
    expect: {
      id: 2,
      name: 'b',
    },
  },
] as Input['scenarios']
