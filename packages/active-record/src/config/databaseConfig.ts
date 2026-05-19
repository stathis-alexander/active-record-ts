/**
 * `config/database.json` loader. Rails-style multi-env config, JSON edition:
 *
 *   {
 *     "default": { "adapter": "postgres", "host": "localhost", "username": "..." },
 *     "development": { "database": "myapp_development" },
 *     "test":        { "database": "myapp_test" },
 *     "production":  { "url": "${DATABASE_URL}" }
 *   }
 *
 * The `default` block is merged into each environment (env keys win on
 * conflict). String values may reference environment variables via the
 * `${VAR}` or `${VAR:-fallback}` syntax — substituted at load time.
 *
 * The Rails adapter aliases `postgresql` / `mysql2` / `sqlite3` are
 * accepted and normalized to active-record's `postgres` / `mysql` /
 * `sqlite`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdapterName, ConnectionConfig } from '../types';

export type DatabaseConfigFile = Record<string, Record<string, unknown>>;

const ADAPTER_ALIASES: Record<string, AdapterName> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  pg: 'postgres',
  'postgres-bun': 'postgres-bun',
  mysql: 'mysql',
  mysql2: 'mysql',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
};

/** Substitute `${VAR}` / `${VAR:-fallback}` references inside a string. */
const expand = (value: string): string =>
  value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gi, (_match, name: string, fallback?: string) => {
    const env = process.env[name];
    if (env !== undefined && env !== '') return env;
    return fallback ?? '';
  });

/** Recursively expand `${ENV}` references inside string values. */
const expandValues = (value: unknown): unknown => {
  if (typeof value === 'string') return expand(value);
  if (Array.isArray(value)) return value.map(expandValues);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = expandValues(v);
    return out;
  }
  return value;
};

/** Determine which environment to load. */
export const currentEnvironment = (): string => process.env.AR_ENV ?? process.env.NODE_ENV ?? 'development';

/** Parse a database.json buffer into the raw config map. */
export const parseDatabaseConfig = (source: string): DatabaseConfigFile => {
  const parsed = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('database.json must be a JSON object keyed by environment name');
  }
  return expandValues(parsed) as DatabaseConfigFile;
};

/** Read database.json from disk. Path defaults to `config/database.json` under `cwd`. */
export const readDatabaseConfig = (path?: string): DatabaseConfigFile => {
  const file = resolve(path ?? 'config/database.json');
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read database config at ${file}: ${(err as Error).message}`);
  }
  return parseDatabaseConfig(source);
};

/** Merge `default` into the named environment. Env keys win on conflict. */
export const resolveEnvironment = (config: DatabaseConfigFile, environment: string): Record<string, unknown> => {
  const base = (config.default ?? {}) as Record<string, unknown>;
  const env = config[environment];
  if (!env) {
    const known =
      Object.keys(config)
        .filter((k) => k !== 'default')
        .join(', ') || '(none)';
    throw new Error(`Environment "${environment}" not found in database.json. Known: ${known}`);
  }
  return { ...base, ...env };
};

/** Normalize a merged env block into a `ConnectionConfig` understood by `buildAdapter`. */
export const toConnectionConfig = (entry: Record<string, unknown>): ConnectionConfig => {
  const rawAdapter = entry.adapter;
  if (typeof rawAdapter !== 'string') {
    throw new Error('database config entry is missing required "adapter" field');
  }
  const adapter = ADAPTER_ALIASES[rawAdapter.toLowerCase()];
  if (!adapter) throw new Error(`Unsupported adapter "${rawAdapter}" in database config`);

  const out: ConnectionConfig = { adapter };
  if (typeof entry.url === 'string') out.url = entry.url;
  if (typeof entry.database === 'string') out.database = entry.database;
  if (typeof entry.host === 'string') out.host = entry.host;
  if (typeof entry.port === 'number') out.port = entry.port;
  else if (typeof entry.port === 'string' && entry.port !== '') out.port = Number(entry.port);
  if (typeof entry.user === 'string') out.user = entry.user;
  if (typeof entry.username === 'string') out.username = entry.username;
  if (typeof entry.password === 'string') out.password = entry.password;
  if (entry.options && typeof entry.options === 'object') {
    out.options = entry.options as Record<string, unknown>;
  }
  return out;
};

/** Load + select + normalize in one call. */
export const loadConnectionConfig = (
  options: { path?: string; environment?: string } = {},
): { environment: string; entry: Record<string, unknown>; connection: ConnectionConfig } => {
  const environment = options.environment ?? currentEnvironment();
  const file = readDatabaseConfig(options.path);
  const entry = resolveEnvironment(file, environment);
  return { environment, entry, connection: toConnectionConfig(entry) };
};
