import { describe, expect, it } from 'vitest';
import { mysqlConnectionOptions } from '../src/core/connection-options';

describe('mysqlConnectionOptions', () => {
  it('reads the server, credentials, database and parameters from the URL', () => {
    expect(
      mysqlConnectionOptions('mysql://app:p%40ss@db.example:3307/shop?ssl=true&charset=utf8mb4'),
    ).toMatchObject({
      host: 'db.example',
      port: 3307,
      user: 'app',
      password: 'p@ss',
      database: 'shop',
      ssl: true,
      charset: 'utf8mb4',
    });
  });

  it('leaves the port to mysql2 when the URL names none', () => {
    expect(mysqlConnectionOptions('mysql://root@localhost/app')).not.toHaveProperty('port');
  });

  it('keeps multiple statements off whatever the URL says', () => {
    expect(
      mysqlConnectionOptions(
        'mysql://root@localhost/app?multipleStatements=true&flags=MULTI_STATEMENTS,-FOUND_ROWS',
      ),
    ).toMatchObject({ multipleStatements: false, flags: ['-FOUND_ROWS'] });
    expect(
      mysqlConnectionOptions('mysql://root@localhost/app?flags=["multi_statements"]'),
    ).toMatchObject({ multipleStatements: false, flags: [] });
  });

  it('sends an object parameter as text whatever the URL says', () => {
    expect(
      mysqlConnectionOptions('mysql://root@localhost/app?stringifyObjects=false'),
    ).toMatchObject({ stringifyObjects: true });
  });

  it('passes the connect timeout it is given', () => {
    expect(mysqlConnectionOptions('mysql://root@localhost/app', 500)).toMatchObject({
      connectTimeout: 500,
    });
  });
});
