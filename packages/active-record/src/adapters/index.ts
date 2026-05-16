import type { ConnectionAdapter } from '../ConnectionAdapter';
import type { ConnectionConfig } from '../types';
import { MySQLAdapter } from './MySQL';
import { PostgresAdapter } from './Postgres';
import { PostgresBunAdapter } from './PostgresBun';
import { SQLiteAdapter } from './SQLite';

export { MySQLAdapter } from './MySQL';
export { PostgresAdapter } from './Postgres';
export { PostgresBunAdapter } from './PostgresBun';
export { SQLiteAdapter } from './SQLite';

/** Construct (but do not connect) the adapter named by `config.adapter`. */
export const buildAdapter = (config: ConnectionConfig): ConnectionAdapter => {
  switch (config.adapter) {
    case 'sqlite':
      return new SQLiteAdapter(config);
    case 'postgres':
      return new PostgresAdapter(config);
    case 'postgres-bun':
      return new PostgresBunAdapter(config);
    case 'mysql':
      return new MySQLAdapter(config);
    default: {
      const exhaustive: never = config.adapter;
      throw new Error(`Unknown adapter: ${exhaustive as string}`);
    }
  }
};
