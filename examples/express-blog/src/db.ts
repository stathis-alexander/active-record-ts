import { Base, buildAdapter, loadConnectionConfig } from '@arelts/active-record';
import { Post, User } from './models';

/**
 * Open a connection using the current env's block from
 * `config/database.json` and load each model's schema. Migrations and
 * schema management are handled by the `active-record` CLI (`bun run
 * db:migrate`, etc.); this function just wires the running app to an
 * already-migrated database.
 */
export async function setupDatabase(): Promise<void> {
  const { connection } = loadConnectionConfig();
  const adapter = buildAdapter(connection);
  await adapter.connect();
  Base.useConnection(adapter);

  await User.loadSchema();
  await Post.loadSchema();
}
