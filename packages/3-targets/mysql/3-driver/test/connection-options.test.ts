import { describe, expect, it } from 'vitest';
import { mysqlConnectionOptions, mysqlPoolSettings } from '../src/core/connection-options';

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

  it('keeps multiple statements off whatever the flags say', () => {
    expect(
      mysqlConnectionOptions('mysql://root@localhost/app?flags=MULTI_STATEMENTS,-FOUND_ROWS'),
    ).toMatchObject({ multipleStatements: false, flags: ['-FOUND_ROWS'] });
    expect(
      mysqlConnectionOptions('mysql://root@localhost/app?flags=["multi_statements"]'),
    ).toMatchObject({ multipleStatements: false, flags: [] });
  });

  it('refuses a URL parameter the driver does not understand', () => {
    for (const parameter of [
      'namedPlaceholders=true',
      'multipleStatements=true',
      'typeCast=false',
    ]) {
      expect(() => mysqlConnectionOptions(`mysql://root@localhost/app?${parameter}`)).toThrow(
        expect.objectContaining({ code: 'RUNTIME.BINDING_INVALID' }),
      );
    }
  });

  it('passes the connect timeout it is given, and leaves out the pool settings', () => {
    const options = mysqlConnectionOptions(
      'mysql://root@localhost/app?connectionLimit=2&poolTimeout=100',
      500,
    );
    expect({
      connectTimeout: options.connectTimeout,
      poolSettings: 'connectionLimit' in options || 'poolTimeout' in options,
    }).toEqual({ connectTimeout: 500, poolSettings: false });
  });
});

describe('mysqlPoolSettings', () => {
  it('reads the pool size and how long to wait for a connection, waiting ten seconds by default', () => {
    expect({
      given: mysqlPoolSettings('mysql://root@localhost/app?connectionLimit=5&poolTimeout=2000'),
      defaults: mysqlPoolSettings('mysql://root@localhost/app?ssl=true'),
    }).toEqual({
      given: { connectionLimit: 5, poolTimeoutMs: 2000 },
      defaults: { connectionLimit: undefined, poolTimeoutMs: 10_000 },
    });
  });

  it('refuses a pool setting that is not a positive integer', () => {
    for (const parameter of ['connectionLimit=0', 'poolTimeout=soon']) {
      expect(() => mysqlPoolSettings(`mysql://root@localhost/app?${parameter}`)).toThrow(
        expect.objectContaining({ code: 'RUNTIME.BINDING_INVALID' }),
      );
    }
  });
});
