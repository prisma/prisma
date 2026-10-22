import { describe, expect, it } from 'vitest';
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
});
