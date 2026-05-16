import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Base, SQLiteAdapter, type ConnectionConfig } from '../../src';

const SQLITE: ConnectionConfig = { adapter: 'sqlite', database: ':memory:' };

class User extends Base {
  static override tableName = 'users';
  declare name: string;
  declare email: string;
  declare age: number;
}

const seedSchema = async (adapter: SQLiteAdapter) => {
  await adapter.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    age INTEGER DEFAULT 0
  )`);
};

let adapter: SQLiteAdapter;

beforeEach(async () => {
  adapter = new SQLiteAdapter(SQLITE);
  await adapter.connect();
  await seedSchema(adapter);
  User.useConnection(adapter);
  await User.loadSchema();
});

afterEach(async () => {
  await adapter.disconnect();
});

describe('Base — basic CRUD', () => {
  test('create persists and assigns the primary key', async () => {
    const u = await User.create({ name: 'Alex', email: 'a@b.c', age: 30 });
    expect(u.persisted).toBe(true);
    expect(u.id).toBe(1);
    expect(u.name).toBe('Alex');
  });

  test('find returns a hydrated record', async () => {
    await User.create({ name: 'Alex' });
    const u = await User.find(1);
    expect(u.name).toBe('Alex');
    expect(u.id).toBe(1);
    expect(u.persisted).toBe(true);
  });

  test('find throws when missing', async () => {
    expect(User.find(999)).rejects.toThrow();
  });

  test('findBy returns null when missing', async () => {
    expect(await User.findBy({ name: 'nope' })).toBe(null);
  });

  test('update modifies persisted row', async () => {
    const u = await User.create({ name: 'Alex' });
    await u.update({ name: 'Sandy' });
    const reloaded = await User.find(u.id);
    expect(reloaded.name).toBe('Sandy');
  });

  test('destroy removes the row', async () => {
    const u = await User.create({ name: 'Alex' });
    await u.destroy();
    expect(u.destroyed).toBe(true);
    expect(await User.exists()).toBe(false);
  });

  test('save returns false on validation failure', async () => {
    class V extends User {}
    V.validates('name', { presence: true });
    V.useConnection(adapter);
    V.attribute('name', 'string');
    const v = new V({ name: '' });
    expect(await v.save()).toBe(false);
    expect(v.persisted).toBe(false);
    expect(v.errors.on('name')).toContain("can't be blank");
  });
});

describe('Base — relations', () => {
  beforeEach(async () => {
    await User.create({ name: 'Alex', age: 30 });
    await User.create({ name: 'Sandy', age: 25 });
    await User.create({ name: 'Casey', age: 35 });
  });

  test('all returns all records', async () => {
    const records = await User.all();
    expect(records.map((r) => r.name).sort()).toEqual(['Alex', 'Casey', 'Sandy']);
  });

  test('where with hash equality', async () => {
    const records = await User.where({ name: 'Sandy' });
    expect(records).toHaveLength(1);
    expect(records[0]?.age).toBe(25);
  });

  test('where with array → IN', async () => {
    const records = await User.where({ name: ['Alex', 'Casey'] });
    expect(records.map((r) => r.name).sort()).toEqual(['Alex', 'Casey']);
  });

  test('order asc and limit', async () => {
    const records = await User.order({ age: 'asc' }).limit(2);
    expect(records.map((r) => r.age)).toEqual([25, 30]);
  });

  test('order desc via shorthand', async () => {
    const records = await User.order({ age: 'desc' });
    expect(records.map((r) => r.age)).toEqual([35, 30, 25]);
  });

  test('first / last with default pk order', async () => {
    const f = await User.first();
    expect(f?.name).toBe('Alex');
    const l = await User.last();
    expect(l?.name).toBe('Casey');
  });

  test('count', async () => {
    expect(await User.count()).toBe(3);
    expect(await User.where({ name: 'Alex' }).count()).toBe(1);
  });

  test('pluck single column', async () => {
    const names = await User.order({ age: 'asc' }).pluck<string>('name');
    expect(names).toEqual(['Sandy', 'Alex', 'Casey']);
  });

  test('thenable: await relation directly', async () => {
    const records = await User.where({ age: 30 });
    expect(records.map((r) => r.name)).toEqual(['Alex']);
  });

  test('exists', async () => {
    expect(await User.exists({ name: 'Sandy' })).toBe(true);
    expect(await User.exists({ name: 'nobody' })).toBe(false);
  });

  test('updateAll bulk update', async () => {
    const n = await User.updateAll({ age: 99 });
    expect(n).toBe(3);
    const ages = await User.pluck<number>('age');
    expect(ages).toEqual([99, 99, 99]);
  });

  test('deleteAll with predicate', async () => {
    const n = await User.deleteAll({ name: 'Alex' });
    expect(n).toBe(1);
    expect(await User.count()).toBe(2);
  });
});

describe('Base — dirty tracking + reload', () => {
  test('dirty changes captured on update', async () => {
    const u = await User.create({ name: 'Alex' });
    u.name = 'Sandy';
    expect(u.changed()).toEqual(['name']);
    await u.save();
    expect(u.changed()).toEqual([]);
    expect(u.savedChanges()).toEqual({ name: ['Alex', 'Sandy'] });
  });

  test('reload restores from DB', async () => {
    const u = await User.create({ name: 'Alex' });
    u.name = 'Pending';
    await u.reload();
    expect(u.name).toBe('Alex');
  });
});

describe('Base — transactions', () => {
  test('commit on success', async () => {
    await User.transaction(async () => {
      await User.create({ name: 'TxOk' });
    });
    expect(await User.exists({ name: 'TxOk' })).toBe(true);
  });

  test('rollback on throw', async () => {
    await expect(
      User.transaction(async () => {
        await User.create({ name: 'TxBad' });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await User.exists({ name: 'TxBad' })).toBe(false);
  });
});
