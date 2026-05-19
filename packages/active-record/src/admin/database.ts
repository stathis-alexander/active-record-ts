/**
 * Server-level CREATE/DROP DATABASE helpers.
 *
 * For Postgres/MySQL the target database itself doesn't exist yet, so we
 * connect to a maintenance DB (`postgres` / `mysql`) and run DDL there.
 *
 * SQLite is just a file: `createDatabase` is a no-op (Bun's `bun:sqlite`
 * creates the file on first connect); `dropDatabase` unlinks the file —
 * unless it's `:memory:`.
 */

import { unlinkSync } from 'node:fs';
import { buildAdapter } from '../adapters';
import type { ConnectionAdapter } from '../ConnectionAdapter';
import type { ConnectionConfig } from '../types';

const isPostgres = (cfg: ConnectionConfig): boolean =>
  cfg.adapter === 'postgres' || cfg.adapter === 'postgres-bun';

/**
 * Derive a "maintenance" ConnectionConfig — same server + credentials, but
 * pointed at a database that's guaranteed to exist (`postgres`, `mysql`).
 * We can run CREATE / DROP for the target DB from there.
 */
const maintenanceConfig = (cfg: ConnectionConfig): ConnectionConfig => {
  const maint: ConnectionConfig = { ...cfg };
  if (isPostgres(cfg)) {
    maint.database = 'postgres';
    if (maint.url) maint.url = swapUrlDatabase(maint.url, 'postgres');
  } else if (cfg.adapter === 'mysql') {
    maint.database = 'mysql';
    if (maint.url) maint.url = swapUrlDatabase(maint.url, 'mysql');
  }
  delete (maint as { options?: unknown }).options; // keep maintenance connection minimal
  return maint;
};

/** Replace the path segment of a `postgres://…/dbname` URL with `nextDb`. */
const swapUrlDatabase = (url: string, nextDb: string): string => {
  try {
    const parsed = new URL(url);
    parsed.pathname = `/${nextDb}`;
    return parsed.toString();
  } catch {
    return url.replace(/\/[^/?]*(\?|$)/, `/${nextDb}$1`);
  }
};

/** Pull the database name out of a config (explicit field, then URL path). */
export const databaseNameFor = (cfg: ConnectionConfig): string => {
  if (cfg.database) return cfg.database;
  if (cfg.url) {
    try {
      return new URL(cfg.url).pathname.replace(/^\//, '');
    } catch {
      const match = cfg.url.match(/\/([^/?]+)(\?|$)/);
      if (match?.[1]) return match[1];
    }
  }
  throw new Error('Could not determine database name from connection config');
};

const withMaintenanceAdapter = async <T>(
  cfg: ConnectionConfig,
  fn: (adapter: ConnectionAdapter) => Promise<T>,
): Promise<T> => {
  const adapter = buildAdapter(maintenanceConfig(cfg));
  await adapter.connect();
  try {
    return await fn(adapter);
  } finally {
    await adapter.disconnect();
  }
};

/** Create the target database (no-op if it already exists). */
export const createDatabase = async (cfg: ConnectionConfig): Promise<{ created: boolean; name: string }> => {
  if (cfg.adapter === 'sqlite') {
    const path = cfg.database ?? cfg.url ?? ':memory:';
    if (path === ':memory:') return { created: true, name: path };
    // bun:sqlite creates the file on connect — but Database constructor is
    // synchronous, so we connect+disconnect immediately to materialize the
    // file even if no migrations run.
    const adapter = buildAdapter(cfg);
    await adapter.connect();
    await adapter.disconnect();
    return { created: true, name: path };
  }
  const name = databaseNameFor(cfg);
  return withMaintenanceAdapter(cfg, async (adapter) => {
    const existsSql = isPostgres(cfg)
      ? `SELECT 1 FROM pg_database WHERE datname = $1`
      : `SELECT 1 FROM information_schema.schemata WHERE schema_name = ?`;
    const placeholder = isPostgres(cfg) ? '$1' : '?';
    const existing = await adapter.execute(existsSql.replace(placeholder, placeholder), [name]);
    if (existing.length > 0) return { created: false, name };
    await adapter.exec(`CREATE DATABASE ${adapter.quoteIdentifier(name)}`);
    return { created: true, name };
  });
};

/** Drop the target database (no-op if it doesn't exist). */
export const dropDatabase = async (cfg: ConnectionConfig): Promise<{ dropped: boolean; name: string }> => {
  if (cfg.adapter === 'sqlite') {
    const path = cfg.database ?? cfg.url ?? ':memory:';
    if (path === ':memory:') return { dropped: true, name: path };
    try {
      unlinkSync(path);
      return { dropped: true, name: path };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { dropped: false, name: path };
      throw err;
    }
  }
  const name = databaseNameFor(cfg);
  return withMaintenanceAdapter(cfg, async (adapter) => {
    if (isPostgres(cfg)) {
      const rows = await adapter.execute(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
      if (rows.length === 0) return { dropped: false, name };
      // FORCE disconnects active sessions (PG13+). Falls back without FORCE if rejected.
      try {
        await adapter.exec(`DROP DATABASE ${adapter.quoteIdentifier(name)} WITH (FORCE)`);
      } catch {
        await adapter.exec(`DROP DATABASE ${adapter.quoteIdentifier(name)}`);
      }
      return { dropped: true, name };
    }
    const rows = await adapter.execute(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = ?`,
      [name],
    );
    if (rows.length === 0) return { dropped: false, name };
    await adapter.exec(`DROP DATABASE ${adapter.quoteIdentifier(name)}`);
    return { dropped: true, name };
  });
};
