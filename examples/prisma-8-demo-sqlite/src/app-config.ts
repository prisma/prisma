import { type as arktype } from 'arktype';

const appConfigSchema = arktype({
  SQLITE_PATH: 'string',
});

export function loadAppConfig() {
  const result = appConfigSchema({
    SQLITE_PATH: process.env['SQLITE_PATH'] ?? './demo.db',
  });
  if (result instanceof arktype.errors) {
    const message = result.map((p: { message: string }) => p.message).join('; ');
    throw new Error(`Invalid app configuration: ${message}`);
  }
  return { databasePath: result.SQLITE_PATH };
}
