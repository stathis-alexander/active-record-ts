/**
 * Cross-adapter integration tests. Parameterized over every adapter whose
 * driver and DB are reachable. Skipped (with a `test.skip`) for any
 * adapter that can't connect, so the suite is non-blocking when
 * docker-compose is down.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Base, Migration, Migrator, buildAdapter, type ConnectionAdapter, type MigrationConstructor } from '../../src';
import { type AdapterSpec, reachableAdapters } from './_harness';

class CreateUsers extends Migration {
  static override version = '20260101000001';
  override async up() {
    await this.createTable('users', (t) => {
      t.string('name', { null: false });
      t.string('email');
      t.integer('age', { default: 0 });
      t.timestamps();
    });
  }
  override async down() {
    await this.dropTable('users');
  }
}

const migrations: MigrationConstructor[] = [CreateUsers];

const reachable = await reachableAdapters();
if (reachable.length === 0) {
  console.warn('[integration] no adapters reachable — set up docker-compose or install drivers to run these tests');
}

for (const spec of reachable) {
  describeAdapter(spec);
}

function describeAdapter(spec: AdapterSpec) {
  describe(`integration:${spec.name}`, () => {
    let adapter: ConnectionAdapter;

    class User extends Base {
      static override tableName = 'users';
      declare name: string;
      declare email: string;
      declare age: number;
    }

    beforeAll(async () => {
      adapter = buildAdapter(spec.config);
      await adapter.connect();
      await spec.resetSchema(adapter);
      const migrator = new Migrator(adapter, migrations);
      await migrator.up();
      User.useConnection(adapter);
      await User.loadSchema();
    });

    afterAll(async () => {
      await spec.resetSchema(adapter);
      await adapter.disconnect();
    });

    beforeEach(async () => {
      await adapter.exec(`DELETE FROM ${adapter.quoteIdentifier('users')}`);
    });

    test('schema reflection includes seeded columns', async () => {
      const cols = await adapter.columns('users');
      const names = cols.map((c) => c.name).sort();
      expect(names).toContain('id');
      expect(names).toContain('name');
      expect(names).toContain('email');
      expect(names).toContain('age');
    });

    test('insert via create assigns id', async () => {
      const u = await User.create({ name: 'Alex', age: 30 });
      expect(u.persisted).toBe(true);
      expect(u.id).toBeDefined();
      expect(Number(u.id)).toBeGreaterThan(0);
    });

    test('where + order + limit', async () => {
      await User.create({ name: 'Alex', age: 30 });
      await User.create({ name: 'Sandy', age: 25 });
      await User.create({ name: 'Casey', age: 35 });
      const rows = await User.order({ age: 'asc' }).limit(2);
      expect(rows.map((r) => r.age)).toEqual([25, 30]);
    });

    test('update modifies persisted row', async () => {
      const u = await User.create({ name: 'A', age: 1 });
      await u.update({ name: 'B' });
      const reloaded = await User.find(u.id);
      expect(reloaded.name).toBe('B');
    });

    test('destroy removes row', async () => {
      const u = await User.create({ name: 'X' });
      await u.destroy();
      expect(await User.exists({ name: 'X' })).toBe(false);
    });

    test('count and pluck', async () => {
      await User.create({ name: 'A', age: 1 });
      await User.create({ name: 'B', age: 2 });
      expect(await User.count()).toBe(2);
      const ages = await User.order({ age: 'asc' }).pluck<number>('age');
      expect(ages.map(Number)).toEqual([1, 2]);
    });

    test('transaction rolls back on error', async () => {
      try {
        await User.transaction(async () => {
          await User.create({ name: 'TxBad' });
          throw new Error('rollback');
        });
      } catch {
        /* expected */
      }
      expect(await User.exists({ name: 'TxBad' })).toBe(false);
    });
  });
}
