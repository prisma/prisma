import { describe, expect, it } from 'vitest';
import { redactDatabaseUrl } from '../src/redact-db-url';

describe('redactDatabaseUrl', () => {
  it('extracts host, port, database, and username', () => {
    const result = redactDatabaseUrl('postgresql://user:pass@db.internal:5432/app_db');

    expect(result).toMatchObject({
      host: 'db.internal',
      port: '5432',
      database: 'app_db',
      username: 'user',
    });
  });

  it('omits empty components', () => {
    const result = redactDatabaseUrl('postgresql://localhost/app_db');

    expect(result).toMatchObject({
      host: 'localhost',
      database: 'app_db',
    });
    expect(result.port).toBeUndefined();
    expect(result.username).toBeUndefined();
  });

  it('returns empty object when parsing fails', () => {
    const result = redactDatabaseUrl('not-a-valid-url');

    expect(result).toEqual({});
  });
});
