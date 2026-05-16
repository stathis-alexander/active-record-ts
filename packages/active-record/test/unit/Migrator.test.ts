import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Migration, Migrator, SQLiteAdapter, type MigrationConstructor } from '../../src';

class CreateUsers extends Migration {
  static override version = '20260101000001';
  override async up() {
    await this.createTable('users', (t) => {
      t.string('name', { null: false });
      t.string('email', { index: { unique: true } });
      t.timestamps();
    });
  }
  override async down() {
    await this.dropTable('users');
  }
}

class AddAgeToUsers extends Migration {
  static override version = '20260101000002';
  override async up() {
    await this.addColumn('users', 'age', 'integer', { default: 0 });
  }
  override async down() {
    await this.removeColumn('users', 'age');
  }
}

const migrations: MigrationConstructor[] = [CreateUsers, AddAgeToUsers];

let adapter: SQLiteAdapter;
let migrator: Migrator;

beforeEach(async () => {
  adapter = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  await adapter.connect();
  migrator = new Migrator(adapter, migrations);
});

afterEach(async () => {
  await adapter.disconnect();
});

describe('Migrator', () => {
  test('up applies all migrations and tracks versions', async () => {
    const ran = await migrator.up();
    expect(ran).toEqual(['20260101000001', '20260101000002']);
    expect(await adapter.tableExists('users')).toBe(true);
    const cols = await adapter.columns('users');
    expect(cols.map((c) => c.name).sort()).toEqual(['age', 'created_at', 'email', 'id', 'name', 'updated_at']);
    expect(await migrator.appliedVersions()).toEqual(['20260101000001', '20260101000002']);
  });

  test('up is idempotent', async () => {
    await migrator.up();
    const second = await migrator.up();
    expect(second).toEqual([]);
  });

  test('rollback reverses the last migration', async () => {
    await migrator.up();
    const reverted = await migrator.rollback();
    expect(reverted).toEqual(['20260101000002']);
    const cols = await adapter.columns('users');
    expect(cols.find((c) => c.name === 'age')).toBeUndefined();
  });

  test('rollback steps=2 unwinds both', async () => {
    await migrator.up();
    const reverted = await migrator.rollback(2);
    expect(reverted).toEqual(['20260101000002', '20260101000001']);
    expect(await adapter.tableExists('users')).toBe(false);
  });

  test('up runs only newly-added migrations', async () => {
    const first = new Migrator(adapter, [CreateUsers]);
    await first.up();
    const second = new Migrator(adapter, [CreateUsers, AddAgeToUsers]);
    const ran = await second.up();
    expect(ran).toEqual(['20260101000002']);
  });
});
