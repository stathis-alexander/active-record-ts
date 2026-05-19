/**
 * Discover migration files from disk.
 *
 * Convention: `db/migrate/<timestamp>_<name>.ts`. Each file exports a
 * default `Migration` subclass. The static `version` is set from the
 * filename prefix if the subclass didn't set one itself — this matches
 * Rails' filename-derived version policy.
 */

import { readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Migration, type MigrationConstructor } from '../Migration';

const MIGRATION_FILE_RE = /^(\d{14}|\d{8,})_([a-zA-Z0-9_]+)\.(ts|js|mjs)$/;

export const findMigrationFiles = (dir: string): Array<{ version: string; path: string }> => {
  const absolute = resolve(dir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: Array<{ version: string; path: string }> = [];
  for (const name of entries) {
    const match = name.match(MIGRATION_FILE_RE);
    if (!match || !match[1]) continue;
    const fullPath = resolve(absolute, name);
    if (!statSync(fullPath).isFile()) continue;
    out.push({ version: match[1], path: fullPath });
  }
  return out.sort((a, b) => a.version.localeCompare(b.version));
};

export const loadMigrations = async (dir: string): Promise<MigrationConstructor[]> => {
  const files = findMigrationFiles(dir);
  const ctors: MigrationConstructor[] = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(file.path).href);
    const candidate = (mod.default ?? mod[Object.keys(mod)[0] ?? '']) as unknown;
    if (typeof candidate !== 'function' || !((candidate as { prototype?: unknown }).prototype instanceof Migration)) {
      throw new Error(`Migration file ${file.path} must default-export a Migration subclass`);
    }
    const ctor = candidate as MigrationConstructor;
    if (!ctor.version) ctor.version = file.version;
    ctors.push(ctor);
  }
  return ctors;
};
