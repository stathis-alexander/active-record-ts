import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Arel } from '@arelts/arel';
import { SQLiteAdapter } from '../../src';

let adapter: SQLiteAdapter;

beforeEach(async () => {
  adapter = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  await adapter.connect();
  await adapter.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    created_at DATETIME
  )`);
});

afterEach(async () => {
  await adapter.disconnect();
});

describe('SQLiteAdapter', () => {
  test('exec INSERT returns lastInsertId', async () => {
    const r = await adapter.exec(`INSERT INTO users (name, age) VALUES (?, ?)`, ['Alex', 30]);
    expect(r.rowsAffected).toBe(1);
    expect(Number(r.lastInsertId)).toBe(1);
  });

  test('execute SELECT returns typed rows', async () => {
    await adapter.exec(`INSERT INTO users (name, age) VALUES (?, ?)`, ['Alex', 30]);
    const rows = await adapter.execute(`SELECT id, name, age FROM users`);
    expect(rows).toEqual([{ id: 1, name: 'Alex', age: 30 }]);
  });

  test('RETURNING surfaces rows on exec', async () => {
    const r = await adapter.exec(`INSERT INTO users (name, age) VALUES (?, ?) RETURNING id, name`, ['Sandy', 25]);
    expect(r.returning).toEqual([{ id: 1, name: 'Sandy' }]);
  });

  test('columns introspection', async () => {
    const cols = await adapter.columns('users');
    expect(cols.map((c) => c.name)).toEqual(['id', 'name', 'age', 'created_at']);
    const id = cols.find((c) => c.name === 'id')!;
    expect(id.isPrimaryKey).toBe(true);
    expect(id.type).toBe('integer');
    expect(cols.find((c) => c.name === 'created_at')!.type).toBe('datetime');
  });

  test('primaryKey returns the pk column', async () => {
    expect(await adapter.primaryKey('users')).toBe('id');
  });

  test('transaction commits on success', async () => {
    await adapter.transaction(async (a) => {
      await a.exec(`INSERT INTO users (name) VALUES (?)`, ['X']);
    });
    const rows = await adapter.execute(`SELECT COUNT(*) AS c FROM users`);
    expect((rows[0] as { c: number }).c).toBe(1);
  });

  test('transaction rolls back on error', async () => {
    await expect(
      adapter.transaction(async (a) => {
        await a.exec(`INSERT INTO users (name) VALUES (?)`, ['X']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await adapter.execute(`SELECT COUNT(*) AS c FROM users`);
    expect((rows[0] as { c: number }).c).toBe(0);
  });

  test('nested transaction uses savepoint, inner rollback preserves outer', async () => {
    await adapter.transaction(async (a) => {
      await a.exec(`INSERT INTO users (name) VALUES (?)`, ['outer']);
      try {
        await a.transaction(async (b) => {
          await b.exec(`INSERT INTO users (name) VALUES (?)`, ['inner']);
          throw new Error('inner boom');
        });
      } catch {
        /* expected */
      }
    });
    const rows = (await adapter.execute(`SELECT name FROM users ORDER BY id`)) as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(['outer']);
  });

  test('toSql round-trips an arel SelectManager into SQL + binds', async () => {
    const users = new Arel.Table('users');
    const id = users.attribute('id');
    const select = users.where(id.equal(new Arel.Nodes.BindParam(1)));
    const [sql, binds] = adapter.toSql(select);
    expect(sql).toContain('FROM "users"');
    expect(sql).toContain('WHERE');
    expect(binds).toEqual([1]);
  });
});
