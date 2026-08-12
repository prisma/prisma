import { flag } from '@prisma/cli-engine';

/**
 * The database connection override, declared from here by every command that
 * accepts one so its brief and placeholder cannot drift apart. Resolution
 * order is the flag, then `config.db.connection`, then
 * `CONFIG.DB_CONNECTION_REQUIRED`.
 */
export const dbFlag = flag.string({
  brief: 'Database connection string',
  placeholder: 'url',
});
