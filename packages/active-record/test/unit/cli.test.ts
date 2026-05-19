import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAdapter } from '../../src';
import { runCli } from '../../src/cli/run';

/**
 * End-to-end CLI test against SQLite. We chdir into a temp dir set up like
 * a real Rails-style project: `config/database.json` + `db/migrate/*.ts`,
 * then run each subcommand in turn and verify the side-effects on disk +
 * in the database file.
 */
describe('runCli', () => {
  const cwdBefore = process.cwd();
  let tmpDir: string;
  let dbPath: string;
  let schemaPath: string;
  let importFrom: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ar-cli-'));
    dbPath = join(tmpDir, 'test.sqlite');
    schemaPath = join(tmpDir, 'db', 'schema.ts');
    importFrom = pathToFileURL(resolvePath(__dirname, '../../src/index.ts')).href;

    // Write database.json pointing at a file-backed SQLite DB (so it
    // survives across separate `runCli` invocations).
    mkdirSync(join(tmpDir, 'config'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'config', 'database.json'),
      JSON.stringify({ test: { adapter: 'sqlite', database: dbPath } }),
    );

    // Write a single migration. It imports the active-record entry point
    // by absolute file:// URL so the workspace doesn't need to be linked.
    mkdirSync(join(tmpDir, 'db', 'migrate'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'db', 'migrate', '20260101000001_create_widgets.ts'),
      `import { Migration } from '${importFrom}';\n` +
        `export default class CreateWidgets extends Migration {\n` +
        `  static override version = '20260101000001';\n` +
        `  override async up() {\n` +
        `    await this.createTable('widgets', (t) => {\n` +
        `      t.string('name', { null: false });\n` +
        `      t.integer('quantity', { default: 0 });\n` +
        `    });\n` +
        `    await this.addIndex('widgets', ['name'], { unique: true, name: 'idx_widgets_name' });\n` +
        `  }\n` +
        `  override async down() { await this.dropTable('widgets'); }\n` +
        `}\n`,
    );

    process.chdir(tmpDir);
    process.env.AR_ENV = 'test';
  });

  afterEach(() => {
    process.chdir(cwdBefore);
    delete process.env.AR_ENV;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('db:create writes the SQLite file', async () => {
    await runCli(['db:create']);
    expect(existsSync(dbPath)).toBe(true);
  });

  test('db:migrate applies pending migrations and writes db/schema.ts', async () => {
    await runCli(['db:create']);
    await runCli(['db:migrate']);
    expect(existsSync(schemaPath)).toBe(true);
    const src = readFileSync(schemaPath, 'utf8');
    expect(src).toContain("s.createTable('widgets'");
    expect(src).toContain("export const version = '20260101000001'");

    // The DB itself has the table.
    const adapter = buildAdapter({ adapter: 'sqlite', database: dbPath });
    await adapter.connect();
    try {
      expect(await adapter.tableExists('widgets')).toBe(true);
    } finally {
      await adapter.disconnect();
    }
  });

  test('db:schema:load recreates tables from a hand-edited schema', async () => {
    await runCli(['db:create']);

    // Hand-craft a schema.ts (using the absolute import path so it
    // resolves inside the temp dir).
    mkdirSync(join(tmpDir, 'db'), { recursive: true });
    writeFileSync(
      schemaPath,
      `import { defineSchema } from '${importFrom}';\n` +
        `export const version = '20260101000099';\n` +
        `export default defineSchema((s) => {\n` +
        `  s.createTable('gadgets', (t) => {\n` +
        `    t.column('label', 'string', { null: false });\n` +
        `  });\n` +
        `});\n`,
    );

    await runCli(['db:schema:load']);

    const adapter = buildAdapter({ adapter: 'sqlite', database: dbPath });
    await adapter.connect();
    try {
      const tables = await adapter.tables();
      expect(tables).toEqual(['gadgets']);
      // schema_migrations was seeded so a subsequent db:migrate would be a no-op.
      const rows = await adapter.execute(`SELECT version FROM schema_migrations`);
      expect((rows as Array<{ version: string }>).map((r) => r.version)).toContain('20260101000099');
    } finally {
      await adapter.disconnect();
    }
  });

  test('db:drop removes the SQLite file', async () => {
    await runCli(['db:create']);
    expect(existsSync(dbPath)).toBe(true);
    await runCli(['db:drop']);
    expect(existsSync(dbPath)).toBe(false);
  });

  test('db:rollback reverts the most recent migration and re-dumps', async () => {
    await runCli(['db:create']);
    await runCli(['db:migrate']);
    await runCli(['db:rollback']);

    const adapter = buildAdapter({ adapter: 'sqlite', database: dbPath });
    await adapter.connect();
    try {
      expect(await adapter.tableExists('widgets')).toBe(false);
    } finally {
      await adapter.disconnect();
    }
  });
});
