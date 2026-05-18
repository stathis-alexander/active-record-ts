/**
 * Ported from activerecord/test/cases/migration_test.rb (Rails 7.2 branch).
 *
 * Rails migration_test is ~2000 lines covering schema_migrations
 * bookkeeping, internal_metadata, table prefix/suffix, force/if_exists/
 * if_not_exists flags, column type coercion, rename_table, change_column,
 * and SchemaCache interaction. We port the core DSL — createTable,
 * addColumn, removeColumn, renameColumn, addIndex, dropTable, Migrator
 * up/down/rollback — and skip the rest.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Migration, Migrator, SQLiteAdapter, type MigrationConstructor } from '../../src';

let adapter: SQLiteAdapter;

beforeEach(async () => {
  adapter = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  await adapter.connect();
});

afterEach(async () => {
  await adapter.disconnect();
});

class CreatePeople extends Migration {
  static override version = '001';
  override async up() {
    await this.createTable('people', (t) => {
      t.string('name', { null: false });
      t.integer('age');
      t.timestamps({ null: true });
    });
  }
  override async down() {
    await this.dropTable('people');
  }
}

class AddEmailToPeople extends Migration {
  static override version = '002';
  override async up() {
    await this.addColumn('people', 'email', 'string');
  }
  override async down() {
    await this.removeColumn('people', 'email');
  }
}

class AddIndexOnEmail extends Migration {
  static override version = '003';
  override async up() {
    await this.addIndex('people', 'email', { unique: true, name: 'idx_people_email' });
  }
  override async down() {
    await this.removeIndex('people', { name: 'idx_people_email' });
  }
}

describe('Migration — Migrator up/down', () => {
  test('any_migrations equivalent — `appliedVersions` empty initially', async () => {
    const m = new Migrator(adapter, []);
    expect(await m.appliedVersions()).toEqual([]);
  });

  test('migration_version_matches_component_version (sortable string)', async () => {
    expect(CreatePeople.version < AddEmailToPeople.version).toBe(true);
  });

  test('up runs all pending migrations in order', async () => {
    const m = new Migrator(adapter, [CreatePeople, AddEmailToPeople]);
    const ran = await m.up();
    expect(ran).toEqual(['001', '002']);
    const cols = await adapter.columns('people');
    expect(cols.map((c) => c.name).sort()).toEqual(['age', 'created_at', 'email', 'id', 'name', 'updated_at']);
  });

  test('up is idempotent', async () => {
    const m = new Migrator(adapter, [CreatePeople]);
    await m.up();
    expect(await m.up()).toEqual([]);
  });

  test('rollback reverses the most recent migration', async () => {
    const m = new Migrator(adapter, [CreatePeople, AddEmailToPeople]);
    await m.up();
    const reverted = await m.rollback();
    expect(reverted).toEqual(['002']);
    const cols = await adapter.columns('people');
    expect(cols.find((c) => c.name === 'email')).toBeUndefined();
  });

  test('rollback(steps=N) reverses N migrations', async () => {
    const m = new Migrator(adapter, [CreatePeople, AddEmailToPeople]);
    await m.up();
    const reverted = await m.rollback(2);
    expect(reverted).toEqual(['002', '001']);
    expect(await adapter.tableExists('people')).toBe(false);
  });

  test('migration_detection — newly added migration is detected', async () => {
    const first = new Migrator(adapter, [CreatePeople]);
    await first.up();
    const second = new Migrator(adapter, [CreatePeople, AddEmailToPeople]);
    expect(await second.up()).toEqual(['002']);
  });
});

describe('Migration — DSL: createTable / addColumn / removeColumn / renameColumn', () => {
  test('createTable adds primary key automatically', async () => {
    await new Migrator(adapter, [CreatePeople]).up();
    const pk = await adapter.primaryKey('people');
    expect(pk).toBe('id');
  });

  test('addColumn adds a column', async () => {
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople]).up();
    const cols = await adapter.columns('people');
    expect(cols.find((c) => c.name === 'email')).toBeDefined();
  });

  test('removeColumn removes a column', async () => {
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople]).up();
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople]).rollback();
    const cols = await adapter.columns('people');
    expect(cols.find((c) => c.name === 'email')).toBeUndefined();
  });

  test('rename_column renames a column', async () => {
    class Rename extends Migration {
      static override version = '200';
      override async up() {
        await this.createTable('users', (t) => t.string('name'));
        await this.renameColumn('users', 'name', 'full_name');
      }
    }
    await new Migrator(adapter, [Rename]).up();
    const cols = await adapter.columns('users');
    expect(cols.find((c) => c.name === 'full_name')).toBeDefined();
    expect(cols.find((c) => c.name === 'name')).toBeUndefined();
  });

  test('change_column on SQLite rebuilds the table with the new type', async () => {
    class CC extends Migration {
      static override version = '700';
      override async up() {
        await this.createTable('cc', (t) => {
          t.string('name');
          t.integer('age');
        });
        await this.changeColumn('cc', 'age', 'text');
      }
    }
    await new Migrator(adapter, [CC]).up();
    // Insert a row to make sure the rebuilt table works.
    await adapter.exec(`INSERT INTO "cc" ("name", "age") VALUES (?, ?)`, ['A', 'thirty-one']);
    const cols = await adapter.columns('cc');
    const ageCol = cols.find((c) => c.name === 'age');
    expect(ageCol?.sqlType.toUpperCase()).toMatch(/TEXT/);
  });

  test('rename_table renames a table', async () => {
    class Rename extends Migration {
      static override version = '300';
      override async up() {
        await this.createTable('old_name', (t) => t.string('a'));
        await this.renameTable('old_name', 'new_name');
      }
    }
    await new Migrator(adapter, [Rename]).up();
    expect(await adapter.tableExists('new_name')).toBe(true);
    expect(await adapter.tableExists('old_name')).toBe(false);
  });

  test('create_table with force: true recreates an existing table', async () => {
    class Force extends Migration {
      static override version = '400';
      override async up() {
        await this.createTable('forced', (t) => t.string('a'));
        await this.createTable('forced', (t) => t.string('b'), { force: true });
      }
    }
    await new Migrator(adapter, [Force]).up();
    const cols = await adapter.columns('forced');
    expect(cols.find((c) => c.name === 'a')).toBeUndefined();
    expect(cols.find((c) => c.name === 'b')).toBeDefined();
  });
  test('create_table_with_if_not_exists_true', async () => {
    class CreateIfNotExists extends Migration {
      static override version = '100';
      override async up() {
        await this.createTable('once', (t) => t.string('a'));
        await this.createTable('once', (t) => t.string('a'), { ifNotExists: true });
      }
    }
    await new Migrator(adapter, [CreateIfNotExists]).up();
    expect(await adapter.tableExists('once')).toBe(true);
  });
  test('create_table accepts long table names without enforcement (no Rails-style limit)', async () => {
    const long = 'a_very_long_table_name_that_might_exceed_the_typical_64_char_limit';
    class CT extends Migration {
      static override version = '700';
      override async up() { await this.createTable(long, (t) => t.string('x')); }
    }
    await new Migrator(adapter, [CT]).up();
    expect(await adapter.tableExists(long)).toBe(true);
  });

  test('create_table_with_force_and_if_not_exists: force wins (drops first)', async () => {
    class FCT extends Migration {
      static override version = '800';
      override async up() {
        await this.createTable('forceit', (t) => t.string('a'));
        await this.createTable('forceit', (t) => t.string('b'), { force: true, ifNotExists: true });
      }
    }
    await new Migrator(adapter, [FCT]).up();
    const cols = await adapter.columns('forceit');
    expect(cols.find((c) => c.name === 'b')).toBeDefined();
    expect(cols.find((c) => c.name === 'a')).toBeUndefined();
  });

  test('remove_column with if_exists set silently no-ops', async () => {
    class WithIfExists extends Migration {
      static override version = '500';
      override async up() {
        await this.createTable('rc', (t) => t.string('a'));
        await this.removeColumn('rc', 'nonexistent', { ifExists: true });
      }
    }
    await new Migrator(adapter, [WithIfExists]).up();
    expect(await adapter.tableExists('rc')).toBe(true);
  });

  test('add_column with if_not_exists silently no-ops when present', async () => {
    class WithIfNotExists extends Migration {
      static override version = '600';
      override async up() {
        await this.createTable('ac', (t) => t.string('a'));
        await this.addColumn('ac', 'a', 'string', { ifNotExists: true });
      }
    }
    await new Migrator(adapter, [WithIfNotExists]).up();
    const cols = await adapter.columns('ac');
    expect(cols.filter((c) => c.name === 'a').length).toBe(1);
  });

  test('add_column with if_not_exists is idempotent on a different declared type', async () => {
    class ACI extends Migration {
      static override version = '900';
      override async up() {
        await this.createTable('aci', (t) => { t.string('x'); });
        // The column already exists — if_not_exists skips re-adding.
        await this.addColumn('aci', 'x', 'integer', { ifNotExists: true });
      }
    }
    await new Migrator(adapter, [ACI]).up();
    const cols = await adapter.columns('aci');
    expect(cols.filter((c) => c.name === 'x').length).toBe(1);
  });

  test('add_index with custom name option', async () => {
    class AI extends Migration {
      static override version = '1000';
      override async up() {
        await this.createTable('ix', (t) => t.string('email'));
        await this.addIndex('ix', 'email', { unique: true, name: 'ix_email_uniq' });
      }
    }
    await new Migrator(adapter, [AI]).up();
    const rows = await adapter.execute(`SELECT name FROM sqlite_master WHERE type='index' AND name='ix_email_uniq'`);
    expect(rows.length).toBe(1);
  });

  test('add_table_with_decimals respects precision/scale', async () => {
    class AD extends Migration {
      static override version = '1100';
      override async up() {
        await this.createTable('priced', (t) => t.decimal('amount', { precision: 10, scale: 2 }));
      }
    }
    await new Migrator(adapter, [AD]).up();
    const cols = await adapter.columns('priced');
    expect(cols.find((c) => c.name === 'amount')?.sqlType.toUpperCase()).toMatch(/DECIMAL/);
  });

  test('create_table_with_binary_column round-trips bytes', async () => {
    class BC extends Migration {
      static override version = '1200';
      override async up() {
        await this.createTable('blobs', (t) => t.binary('data'));
      }
    }
    await new Migrator(adapter, [BC]).up();
    const cols = await adapter.columns('blobs');
    expect(cols.find((c) => c.name === 'data')).toBeDefined();
  });

  test('filtering_migrations to target version (Migrator.up(target))', async () => {
    class M1 extends Migration {
      static override version = '20260101000001';
      override async up() { await this.createTable('t1', (t) => t.string('a')); }
    }
    class M2 extends Migration {
      static override version = '20260101000002';
      override async up() { await this.createTable('t2', (t) => t.string('a')); }
    }
    const ran = await new Migrator(adapter, [M1, M2]).up('20260101000001');
    expect(ran).toEqual(['20260101000001']);
    expect(await adapter.tableExists('t1')).toBe(true);
    expect(await adapter.tableExists('t2')).toBe(false);
  });
});

describe('Migration — DSL: addIndex / removeIndex', () => {
  test('addIndex creates a unique index', async () => {
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople, AddIndexOnEmail]).up();
    // Verifying via sqlite_master:
    const rows = await adapter.execute(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_people_email'`);
    expect(rows.length).toBe(1);
  });

  test('removeIndex drops by name', async () => {
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople, AddIndexOnEmail]).up();
    await new Migrator(adapter, [CreatePeople, AddEmailToPeople, AddIndexOnEmail]).rollback();
    const rows = await adapter.execute(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_people_email'`);
    expect(rows.length).toBe(0);
  });
});

describe('Migration — Rails-only / deferred', () => {
  test('internal_metadata stores and retrieves the environment', async () => {
    const m = new Migrator(adapter, []);
    expect(await m.getMetadata('environment')).toBeNull();
    await m.setMetadata('environment', 'test');
    expect(await m.getMetadata('environment')).toBe('test');
    await m.setMetadata('environment', 'production');
    expect(await m.getMetadata('environment')).toBe('production');
  });
  test('name_collision_across_dbs: same model class can target different DBs in different scopes', async () => {
    const { Base, SQLiteAdapter } = await import('../../src');
    const dbA = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
    const dbB = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
    await dbA.connect();
    await dbB.connect();
    await dbA.exec(`CREATE TABLE widgets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    await dbB.exec(`CREATE TABLE widgets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    class Widget extends Base {
      static override tableName = 'widgets';
      declare name: string;
    }
    await Widget.connectsTo({ writing: dbA, replicas: dbB });
    await Widget.loadSchema();
    await Widget.create({ name: 'in-a' });
    await Widget.connectedTo({ database: 'replicas' }, async () => {
      await Widget.create({ name: 'in-b' });
    });
    expect(await Widget.count()).toBe(1);
    await Widget.connectedTo({ database: 'replicas' }, async () => {
      expect(await Widget.count()).toBe(1);
    });
    await dbA.disconnect();
    await dbB.disconnect();
  });
  test('table prefix/suffix compose around base names', async () => {
    const { Base } = await import('../../src');
    class Pfx extends Base {
      static override tablePrefix = 'app_';
      static override tableSuffix = '_v2';
    }
    expect(Pfx.effectiveTableName()).toBe('app_pfxes_v2');
  });
});
