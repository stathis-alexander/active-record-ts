import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConnectionConfig,
  parseDatabaseConfig,
  resolveEnvironment,
  toConnectionConfig,
} from '../../src/config/databaseConfig';

describe('databaseConfig', () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true });
    delete process.env.AR_TEST_DB_URL;
  });

  const writeConfig = (contents: Record<string, unknown>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ar-config-'));
    cleanup.push(dir);
    const path = join(dir, 'database.json');
    writeFileSync(path, JSON.stringify(contents));
    return path;
  };

  test('parseDatabaseConfig rejects non-object roots', () => {
    expect(() => parseDatabaseConfig('[]')).toThrow(/object keyed by environment/);
  });

  test('resolveEnvironment merges default into the env block', () => {
    const cfg = parseDatabaseConfig(
      JSON.stringify({
        default: { adapter: 'postgres', host: 'localhost', username: 'u' },
        development: { database: 'dev_db' },
      }),
    );
    const entry = resolveEnvironment(cfg, 'development');
    expect(entry).toMatchObject({
      adapter: 'postgres',
      host: 'localhost',
      username: 'u',
      database: 'dev_db',
    });
  });

  test('env values override default values', () => {
    const cfg = parseDatabaseConfig(
      JSON.stringify({
        default: { adapter: 'postgres', host: 'shared.example' },
        test: { host: 'test.example', database: 't' },
      }),
    );
    const entry = resolveEnvironment(cfg, 'test');
    expect(entry.host).toBe('test.example');
  });

  test('resolveEnvironment errors on missing env', () => {
    const cfg = parseDatabaseConfig(JSON.stringify({ development: { adapter: 'sqlite', database: ':memory:' } }));
    expect(() => resolveEnvironment(cfg, 'staging')).toThrow(/staging.*not found/);
  });

  test('${ENV} substitution uses process env', () => {
    process.env.AR_TEST_DB_URL = 'postgres://example';
    const cfg = parseDatabaseConfig(
      JSON.stringify({ production: { adapter: 'postgres', url: '${AR_TEST_DB_URL}' } }),
    );
    expect(resolveEnvironment(cfg, 'production').url).toBe('postgres://example');
  });

  test('${ENV:-fallback} uses the fallback when unset', () => {
    delete process.env.AR_TEST_DB_URL;
    const cfg = parseDatabaseConfig(
      JSON.stringify({ test: { adapter: 'sqlite', database: '${AR_TEST_DB_URL:-fallback.db}' } }),
    );
    expect(resolveEnvironment(cfg, 'test').database).toBe('fallback.db');
  });

  test('toConnectionConfig normalizes Rails-style adapter aliases', () => {
    expect(toConnectionConfig({ adapter: 'postgresql', database: 'x' }).adapter).toBe('postgres');
    expect(toConnectionConfig({ adapter: 'mysql2', database: 'x' }).adapter).toBe('mysql');
    expect(toConnectionConfig({ adapter: 'sqlite3', database: 'x' }).adapter).toBe('sqlite');
  });

  test('toConnectionConfig rejects unknown adapters', () => {
    expect(() => toConnectionConfig({ adapter: 'oracle' })).toThrow(/Unsupported adapter/);
  });

  test('toConnectionConfig coerces string ports to numbers', () => {
    expect(toConnectionConfig({ adapter: 'postgres', port: '5432' }).port).toBe(5432);
  });

  test('loadConnectionConfig reads from disk and selects env', () => {
    const path = writeConfig({
      default: { adapter: 'sqlite' },
      test: { database: ':memory:' },
    });
    const { environment, connection } = loadConnectionConfig({ path, environment: 'test' });
    expect(environment).toBe('test');
    expect(connection).toEqual({ adapter: 'sqlite', database: ':memory:' });
  });
});
