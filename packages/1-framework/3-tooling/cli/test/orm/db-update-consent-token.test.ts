import { describe, expect, it } from 'vitest';
import { destructiveConsentToken } from '../../src/orm/db/consent';

const TARGET_ID = 'postgres';

function tokenFor(connection: unknown): string {
  return destructiveConsentToken(connection, TARGET_ID);
}

describe('the destructive consent token', () => {
  describe('from a connection URL that names a database', () => {
    it('takes the database from the path', () => {
      expect(tokenFor('postgres://user:secret@localhost:5432/appdb')).toBe('appdb');
    });

    it('takes the first path segment, not the last', () => {
      expect(tokenFor('postgres://host/appdb/extra')).toBe('appdb');
    });

    it('decodes a percent-escaped space', () => {
      expect(tokenFor('postgres://host/my%20db')).toBe('my db');
    });

    it('decodes percent-escaped UTF-8', () => {
      expect(tokenFor('postgres://host/caf%C3%A9')).toBe('café');
    });

    it('keeps a malformed escape sequence as it was written', () => {
      expect(tokenFor('postgres://host/%E0%A4%A')).toBe('%E0%A4%A');
    });

    it('decodes a name that is nothing but a space, which the command then refuses', () => {
      expect(tokenFor('postgres://host/%20')).toBe(' ');
    });

    it('reads a mysql URL the same way', () => {
      expect(tokenFor('mysql://root@localhost:3306/appdb')).toBe('appdb');
    });

    it('reads a mongodb URL the same way', () => {
      expect(tokenFor('mongodb://localhost:27017/appdb?replicaSet=rs0')).toBe('appdb');
    });
  });

  describe('from a connection URL that names no database', () => {
    it('names the server a bare host URL points at', () => {
      expect(tokenFor('postgres://localhost:5432')).toBe('localhost:5432');
    });

    it('names the cluster a mongodb+srv URL points at', () => {
      expect(tokenFor('mongodb+srv://cluster.example.com/?retryWrites=true')).toBe(
        'cluster.example.com',
      );
    });

    it('names the host an accelerate URL points at', () => {
      expect(tokenFor('prisma+postgres://accelerate.prisma-data.net/?api_key=secret')).toBe(
        'accelerate.prisma-data.net',
      );
    });
  });

  describe('from a URL that carries a file path rather than a host', () => {
    it('names the file, which is where a path puts the database', () => {
      expect(tokenFor('file:./demo.db')).toBe('demo.db');
    });

    it('names the file of an absolute path', () => {
      expect(tokenFor('sqlite:/var/lib/app/demo.db')).toBe('demo.db');
    });
  });

  describe('from a driver connection object', () => {
    it('takes the database the object names', () => {
      expect(tokenFor({ host: 'localhost', port: 5432, database: 'appdb' })).toBe('appdb');
    });

    it('falls back to the target id when the object names no database', () => {
      expect(tokenFor({ host: 'localhost', port: 5432 })).toBe(TARGET_ID);
    });

    it('falls back to the target id when the named database is empty', () => {
      expect(tokenFor({ database: '' })).toBe(TARGET_ID);
    });
  });

  describe('from a connection the rules do not recognise', () => {
    it('falls back to the target id for a libpq keyword string', () => {
      expect(tokenFor('host=localhost port=5432 dbname=appdb')).toBe(TARGET_ID);
    });

    it('falls back to the target id for a bare file path', () => {
      expect(tokenFor('./demo.db')).toBe(TARGET_ID);
    });

    it('falls back to the target id for a connection that is not a string or object', () => {
      expect(tokenFor(undefined)).toBe(TARGET_ID);
    });
  });
});
