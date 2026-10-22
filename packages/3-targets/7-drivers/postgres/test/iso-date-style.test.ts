import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isoDateStyleConnectionConfig } from '../src/iso-date-style';

describe('the connection settings of a connection Prisma opens from a URL', () => {
  it('set DateStyle=ISO as a startup option and keep what the URL says', () => {
    expect(
      isoDateStyleConnectionConfig(
        'postgres://someone:secret@db.example.com:6543/app?application_name=reports',
      ),
    ).toEqual({
      user: 'someone',
      password: 'secret',
      host: 'db.example.com',
      port: 6543,
      database: 'app',
      application_name: 'reports',
      options: '-c DateStyle=ISO',
    });
  });

  it('add DateStyle=ISO after the startup options the URL gives, so it wins over a DateStyle there', () => {
    expect(
      isoDateStyleConnectionConfig(
        'postgres://db.example.com/app?options=-c%20search_path%3Dreports%20-c%20DateStyle%3DGerman',
      ).options,
    ).toBe('-c search_path=reports -c DateStyle=German -c DateStyle=ISO');
  });

  describe('with PGOPTIONS set', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('add DateStyle=ISO after PGOPTIONS when the URL gives no options, as pg reads PGOPTIONS then', () => {
      vi.stubEnv('PGOPTIONS', '-c search_path=reports');

      expect(isoDateStyleConnectionConfig('postgres://db.example.com/app').options).toBe(
        '-c search_path=reports -c DateStyle=ISO',
      );
    });

    it('add DateStyle=ISO after the URL options, which pg reads in place of PGOPTIONS', () => {
      vi.stubEnv('PGOPTIONS', '-c search_path=reports');

      expect(
        isoDateStyleConnectionConfig('postgres://db.example.com/app?options=-c%20work_mem%3D64MB')
          .options,
      ).toBe('-c work_mem=64MB -c DateStyle=ISO');
    });
  });

  it('pass on only the connection settings pg reads from a URL, so a query parameter cannot set up the pool or the socket', () => {
    const config = isoDateStyleConnectionConfig(
      'postgres://db.example.com/app?max=3&keepAlive=false&idleTimeoutMillis=1',
    );
    const pool = new pg.Pool(config);

    expect({
      keys: Object.keys(config).sort(),
      max: pool.options.max,
      idleTimeoutMillis: pool.options.idleTimeoutMillis,
    }).toEqual({
      keys: ['database', 'host', 'options', 'password', 'user'],
      max: new pg.Pool().options.max,
      idleTimeoutMillis: new pg.Pool().options.idleTimeoutMillis,
    });
  });
});
