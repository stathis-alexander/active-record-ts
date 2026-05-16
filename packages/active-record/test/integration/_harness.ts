/**
 * Adapter probe for integration tests. Each adapter has a factory plus a
 * `probe()` that connects + disconnects to verify the DB is reachable.
 *
 * The integration suite skips an adapter whose probe fails — so the suite
 * works whether or not docker-compose is up.
 */

import { ConnectionAdapter, buildAdapter, type ConnectionConfig } from '../../src';

type AdapterSpec = {
  name: string;
  config: ConnectionConfig;
  /** Driver-specific bootstrapping to drop and recreate the test DB. */
  resetSchema: (adapter: ConnectionAdapter) => Promise<void>;
};

const PG_URL = process.env.AR_PG_URL ?? 'postgres://arelts:arelts@localhost:54329/arelts_test';
const MYSQL_URL = process.env.AR_MYSQL_URL ?? 'mysql://arelts:arelts@127.0.0.1:33069/arelts_test';

const dropTables = async (adapter: ConnectionAdapter, names: string[]) => {
  for (const t of names) {
    try {
      await adapter.exec(`DROP TABLE IF EXISTS ${adapter.quoteIdentifier(t)}`);
    } catch {
      /* ignore — table may not exist */
    }
  }
};

const ALL: AdapterSpec[] = [
  {
    name: 'sqlite',
    config: { adapter: 'sqlite', database: ':memory:' },
    resetSchema: async (a) => dropTables(a, ['users', 'posts', 'schema_migrations']),
  },
  {
    name: 'postgres',
    config: { adapter: 'postgres', url: PG_URL },
    resetSchema: async (a) => dropTables(a, ['users', 'posts', 'schema_migrations']),
  },
  {
    name: 'mysql',
    config: { adapter: 'mysql', url: MYSQL_URL },
    resetSchema: async (a) => dropTables(a, ['users', 'posts', 'schema_migrations']),
  },
];

if (process.env.AR_BUN_PG === '1') {
  ALL.push({
    name: 'postgres-bun',
    config: { adapter: 'postgres-bun', url: PG_URL },
    resetSchema: async (a) => dropTables(a, ['users', 'posts', 'schema_migrations']),
  });
}

/** Resolve only the adapters whose driver connects successfully. */
export const reachableAdapters = async (): Promise<AdapterSpec[]> => {
  const reachable: AdapterSpec[] = [];
  for (const spec of ALL) {
    const adapter = buildAdapter(spec.config);
    try {
      await adapter.connect();
      // Sanity ping: every adapter speaks `SELECT 1`.
      await adapter.execute('SELECT 1 AS one');
      await adapter.disconnect();
      reachable.push(spec);
    } catch {
      // Driver missing or DB unreachable. Skip.
    }
  }
  return reachable;
};

export type { AdapterSpec };
