import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SQLiteAdapter } from '../../src/adapters/SQLite';
import { Migration, Migrator } from '../../src';
import { dumpSchemaSource } from '../../src/schema/SchemaDumper';
import { loadSchema, type SchemaDefinition } from '../../src/schema/Schema';

class CreateUsers extends Migration {
  static override version = '20260101000001';
  override async up() {
    await this.createTable('users', (t) => {
      t.string('email', { null: false, limit: 100 });
      t.integer('age', { default: 0 });
      t.boolean('active', { default: true });
      t.timestamps();
    });
    await this.addIndex('users', ['email'], { unique: true, name: 'idx_users_email' });
  }
  override async down() {
    await this.dropTable('users');
  }
}

class CreatePosts extends Migration {
  static override version = '20260101000002';
  override async up() {
    await this.createTable('posts', (t) => {
      t.string('title', { null: false });
      t.text('body');
      t.integer('user_id', { null: false });
    });
  }
  override async down() {
    await this.dropTable('posts');
  }
}

describe('SchemaDumper', () => {
  let adapter: SQLiteAdapter;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ar-schema-'));
    adapter = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
    await adapter.connect();
    const migrator = new Migrator(adapter, [CreateUsers, CreatePosts]);
    await migrator.up();
  });

  afterEach(async () => {
    await adapter.disconnect();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dumpSchemaSource emits a defineSchema module', async () => {
    const source = await dumpSchemaSource(adapter, { version: '20260101000002' });
    expect(source).toContain("import { defineSchema } from '@arelts/active-record'");
    expect(source).toContain("export const version = '20260101000002'");
    expect(source).toContain("s.createTable('users'");
    expect(source).toContain("s.createTable('posts'");
    expect(source).toContain("t.column('email'");
    expect(source).toContain("s.addIndex('users', ['email']");
    expect(source).toContain('unique: true');
  });

  test('roundtrip: dump then load recreates the same tables', async () => {
    const indexPath = resolvePath(__dirname, '../../src/index.ts');
    const source = await dumpSchemaSource(adapter, {
      version: '20260101000002',
      importFrom: pathToFileURL(indexPath).href,
    });
    const schemaPath = join(tmpDir, 'schema.ts');
    writeFileSync(schemaPath, source);

    const fresh = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
    await fresh.connect();
    try {
      const mod = await import(pathToFileURL(schemaPath).href);
      const def = mod.default as SchemaDefinition;
      await loadSchema(fresh, def);

      const tables = (await fresh.tables()).sort();
      expect(tables).toEqual(['posts', 'users']);

      const userCols = (await fresh.columns('users')).map((c) => c.name).sort();
      expect(userCols).toEqual(['active', 'age', 'created_at', 'email', 'id', 'updated_at']);

      const indexes = await fresh.indexes('users');
      expect(indexes.some((i) => i.name === 'idx_users_email' && i.unique)).toBe(true);
    } finally {
      await fresh.disconnect();
    }
  });

  test('SchemaDumper skips schema_migrations and ar_internal_metadata', async () => {
    // Migrator already created schema_migrations; touch metadata too.
    const migrator = new Migrator(adapter, []);
    await migrator.setMetadata('environment', 'test');
    const source = await dumpSchemaSource(adapter);
    expect(source).not.toContain('schema_migrations');
    expect(source).not.toContain('ar_internal_metadata');
  });
});
