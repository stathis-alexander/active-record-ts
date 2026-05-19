/**
 * `active-record` CLI dispatcher.
 *
 * Usage:
 *
 *   bunx active-record <command> [options]
 *
 * Commands:
 *   db:create              Create the database for the current env.
 *   db:drop                Drop the database for the current env.
 *   db:migrate             Apply pending migrations + dump schema.ts.
 *   db:rollback [--step N] Roll back the last N migrations + dump schema.ts.
 *   db:schema:dump         Re-dump db/schema.ts from the current DB state.
 *   db:schema:load         Drop everything and recreate from db/schema.ts.
 *
 * Options:
 *   --env <name>           Override the env (defaults to AR_ENV / NODE_ENV).
 *   --config <path>        Path to database.json (defaults to config/database.json).
 *   --migrations <dir>     Migrations directory (defaults to db/migrate).
 *   --schema <path>        Schema file path (defaults to db/schema.ts).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAdapter } from '../adapters';
import { loadConnectionConfig } from '../config/databaseConfig';
import type { ConnectionAdapter } from '../ConnectionAdapter';
import { createDatabase, dropDatabase } from '../admin/database';
import { Migrator } from '../Migrator';
import { dumpSchemaSource } from '../schema/SchemaDumper';
import { loadSchema, type SchemaDefinition } from '../schema/Schema';
import { loadMigrations } from './migrations';

export type CliOptions = {
  env?: string;
  config?: string;
  migrations?: string;
  schema?: string;
  step?: number;
};

const parseArgs = (argv: string[]): { command: string; options: CliOptions } => {
  const [command, ...rest] = argv;
  if (!command) throw new Error('Missing command. See `active-record --help`.');
  const options: CliOptions = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const next = (): string => {
      const v = rest[i + 1];
      if (v === undefined) throw new Error(`Option ${arg} requires a value`);
      i++;
      return v;
    };
    switch (arg) {
      case '--env': options.env = next(); break;
      case '--config': options.config = next(); break;
      case '--migrations': options.migrations = next(); break;
      case '--schema': options.schema = next(); break;
      case '--step':
      case '--steps': options.step = Number(next()); break;
      default:
        throw new Error(`Unknown option "${arg}" for command "${command}"`);
    }
  }
  return { command, options };
};

const log = (msg: string): void => {
  console.log(`[active-record] ${msg}`);
};

const withAdapter = async <T>(
  options: CliOptions,
  fn: (adapter: ConnectionAdapter, env: string) => Promise<T>,
): Promise<T> => {
  const { environment, connection } = loadConnectionConfig({
    path: options.config,
    environment: options.env,
  });
  const adapter = buildAdapter(connection);
  await adapter.connect();
  try {
    return await fn(adapter, environment);
  } finally {
    await adapter.disconnect();
  }
};

const writeSchemaFile = async (
  adapter: ConnectionAdapter,
  schemaPath: string,
  version: string | undefined,
): Promise<void> => {
  const source = await dumpSchemaSource(adapter, { version });
  const absolute = resolve(schemaPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, source, 'utf8');
  log(`wrote ${absolute}`);
};

const dbCreate = async (options: CliOptions): Promise<void> => {
  const { environment, connection } = loadConnectionConfig({
    path: options.config,
    environment: options.env,
  });
  const result = await createDatabase(connection);
  log(`db:create (${environment}) — ${result.created ? 'created' : 'already exists'}: ${result.name}`);
};

const dbDrop = async (options: CliOptions): Promise<void> => {
  const { environment, connection } = loadConnectionConfig({
    path: options.config,
    environment: options.env,
  });
  const result = await dropDatabase(connection);
  log(`db:drop (${environment}) — ${result.dropped ? 'dropped' : 'did not exist'}: ${result.name}`);
};

const dbMigrate = async (options: CliOptions): Promise<void> => {
  const migDir = options.migrations ?? 'db/migrate';
  const schemaPath = options.schema ?? 'db/schema.ts';
  const migrations = await loadMigrations(migDir);
  await withAdapter(options, async (adapter, env) => {
    const migrator = new Migrator(adapter, migrations);
    const ran = await migrator.up();
    if (ran.length === 0) log(`db:migrate (${env}) — nothing to apply`);
    else log(`db:migrate (${env}) — applied ${ran.length}: ${ran.join(', ')}`);
    const versions = await migrator.appliedVersions();
    const latest = versions[versions.length - 1];
    await writeSchemaFile(adapter, schemaPath, latest);
  });
};

const dbRollback = async (options: CliOptions): Promise<void> => {
  const migDir = options.migrations ?? 'db/migrate';
  const schemaPath = options.schema ?? 'db/schema.ts';
  const migrations = await loadMigrations(migDir);
  const steps = options.step ?? 1;
  await withAdapter(options, async (adapter, env) => {
    const migrator = new Migrator(adapter, migrations);
    const reverted = await migrator.rollback(steps);
    if (reverted.length === 0) log(`db:rollback (${env}) — nothing to revert`);
    else log(`db:rollback (${env}) — reverted ${reverted.length}: ${reverted.join(', ')}`);
    const versions = await migrator.appliedVersions();
    const latest = versions[versions.length - 1];
    await writeSchemaFile(adapter, schemaPath, latest);
  });
};

const dbSchemaDump = async (options: CliOptions): Promise<void> => {
  const schemaPath = options.schema ?? 'db/schema.ts';
  await withAdapter(options, async (adapter, env) => {
    const migrator = new Migrator(adapter, []);
    const versions = await migrator.appliedVersions().catch(() => []);
    const latest = versions[versions.length - 1];
    await writeSchemaFile(adapter, schemaPath, latest);
    log(`db:schema:dump (${env}) — done`);
  });
};

const dbSchemaLoad = async (options: CliOptions): Promise<void> => {
  const schemaPath = resolve(options.schema ?? 'db/schema.ts');
  const mod = await import(pathToFileURL(schemaPath).href);
  const definition = (mod.default ?? mod.schema) as SchemaDefinition | undefined;
  if (!definition || typeof definition.apply !== 'function') {
    throw new Error(`${schemaPath} must default-export a defineSchema(...) definition`);
  }
  const version = typeof mod.version === 'string' ? (mod.version as string) : undefined;
  await withAdapter(options, async (adapter, env) => {
    await loadSchema(adapter, definition);
    // Restore the schema_migrations row so the next `db:migrate` is a no-op.
    if (version) {
      const migrator = new Migrator(adapter, []);
      await migrator.ensureSchemaTable();
      const applied = new Set(await migrator.appliedVersions());
      if (!applied.has(version)) {
        await adapter.exec(
          `INSERT INTO ${adapter.quoteIdentifier('schema_migrations')} (${adapter.quoteIdentifier('version')}) VALUES (${
            adapter.adapterName.startsWith('postgres') ? '$1' : '?'
          })`,
          [version],
        );
      }
    }
    log(`db:schema:load (${env}) — loaded ${schemaPath}`);
  });
};

const COMMANDS: Record<string, (options: CliOptions) => Promise<void>> = {
  'db:create': dbCreate,
  'db:drop': dbDrop,
  'db:migrate': dbMigrate,
  'db:rollback': dbRollback,
  'db:schema:dump': dbSchemaDump,
  'db:schema:load': dbSchemaLoad,
};

export const runCli = async (argv: string[]): Promise<void> => {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(USAGE);
    return;
  }
  const { command, options } = parseArgs(argv);
  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command "${command}".\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  await handler(options);
};

const USAGE = `Usage: active-record <command> [options]

Commands:
  db:create              Create the database for the current env
  db:drop                Drop the database for the current env
  db:migrate             Apply pending migrations and dump db/schema.ts
  db:rollback [--step N] Roll back the last N migrations and dump db/schema.ts
  db:schema:dump         Re-dump db/schema.ts from the current DB state
  db:schema:load         Drop everything and recreate from db/schema.ts

Options:
  --env <name>           Override AR_ENV / NODE_ENV
  --config <path>        Path to database.json (default: config/database.json)
  --migrations <dir>     Migrations directory (default: db/migrate)
  --schema <path>        Schema file path (default: db/schema.ts)
`;
