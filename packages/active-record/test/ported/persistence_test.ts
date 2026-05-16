/**
 * Ported from activerecord/test/cases/persistence_test.rb (Rails 7.2 branch).
 *
 * The Rails persistence_test is ~1800 lines covering increment/decrement,
 * composite primary keys, `becomes` (STI conversion), `update_many` bulk
 * helpers, `touch_all`, and many more. We port the core save/update/
 * destroy/delete_all surface; the rest is `test.skip` with TODOs.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { type Fixtures, setupFixtures, Topic, Post, Developer } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => {
  fx = await setupFixtures();
});
afterAll(async () => {
  await fx.teardown();
});
beforeEach(async () => {
  await fx.reset();
});

describe('Persistence — create / save / update / destroy', () => {
  test('save assigns autoincremented id', async () => {
    const t = new Topic({ title: 'autoincrement' });
    await t.save();
    expect(Number(t.id)).toBeGreaterThan(0);
  });

  test('class-level create returns a persisted record', async () => {
    const t = await Topic.create({ title: 'klass-create' });
    expect(t.persisted).toBe(true);
  });

  test('updating in-memory then saving updates the row', async () => {
    const t = await Topic.create({ title: 'one' });
    t.writeAttribute('title', 'two');
    await t.save();
    const reloaded = await Topic.find(t.id);
    expect(reloaded.readAttribute('title')).toBe('two');
  });

  test('update method assigns and saves', async () => {
    const t = await Topic.create({ title: 'one' });
    await t.update({ title: 'two' });
    const reloaded = await Topic.find(t.id);
    expect(reloaded.readAttribute('title')).toBe('two');
  });

  test('destroy removes the row', async () => {
    const t = await Topic.create({ title: 'goner' });
    await t.destroy();
    expect(t.destroyed).toBe(true);
    expect(await Topic.exists()).toBe(false);
  });

  test('destroy on already-destroyed record is idempotent', async () => {
    const t = await Topic.create({ title: 'a' });
    await t.destroy();
    await t.destroy();
    expect(t.destroyed).toBe(true);
  });

  test('delete_all without conditions wipes the table', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    const n = await Topic.deleteAll();
    expect(n).toBe(2);
    expect(await Topic.count()).toBe(0);
  });

  test('delete_all with conditions deletes only matching rows', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    const n = await Topic.deleteAll({ title: 'a' });
    expect(n).toBe(1);
    expect(await Topic.count()).toBe(1);
  });

  test('update_all bulk-update', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    const n = await Topic.updateAll({ author_name: 'shared' });
    expect(n).toBe(2);
    const names = await Topic.pluck<string>('author_name');
    expect(names).toEqual(['shared', 'shared']);
  });

  test('class-level destroy_all destroys each record', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    const records = await Topic.destroyAll();
    expect(records.length).toBe(2);
    expect(records.every((r) => r.destroyed)).toBe(true);
    expect(await Topic.count()).toBe(0);
  });

  test('returns_object_even_if_validations_failed', async () => {
    class Strict extends Post {}
    Strict.validatesPresenceOf('title');
    Strict.useConnection(fx.adapter);
    await Strict.loadSchema();
    const p = new Strict({ body: 'no title' });
    const ok = await p.save();
    expect(ok).toBe(false);
    expect(p.persisted).toBe(false);
    expect(p.errors.on('title').length > 0).toBe(true);
  });

  test('raises_error_when_validations_failed (saveOrThrow)', async () => {
    class Strict extends Developer {}
    Strict.validatesPresenceOf('name');
    Strict.useConnection(fx.adapter);
    await Strict.loadSchema();
    const d = new Strict();
    await expect(d.saveOrThrow()).rejects.toThrow();
  });

  test.skip('populates non-primary-key autoincremented column (TODO: returning multi-pk)', () => {});
  test.skip('autoincrement regardless of column order (TODO)', () => {});
  test.skip('composite primary key autoincrement (TODO: cpk)', () => {});
  test.skip('update_many / update_many! (TODO: batch update by id)', () => {});
  test.skip('update_many with array of records (TODO)', () => {});
  test.skip('class-level update without ids (TODO)', () => {});
  test.skip('class-level update is affected by scoping (TODO: scoping)', () => {});
  test('destroy([ids]) instantiates each and calls destroy()', async () => {
    const a = await Topic.create({ title: 'a' });
    const b = await Topic.create({ title: 'b' });
    const destroyed = (await Topic.destroy([a.id, b.id])) as Topic[];
    expect(destroyed.length).toBe(2);
    expect(destroyed.every((r) => r.destroyed)).toBe(true);
    expect(await Topic.count()).toBe(0);
  });

  test('destroy(id) returns the single record', async () => {
    const a = await Topic.create({ title: 'a' });
    const r = await Topic.destroy(a.id) as Topic;
    expect(r.destroyed).toBe(true);
  });

  test('destroy([id]) raises when an id is missing', async () => {
    await expect(Topic.destroy([999])).rejects.toThrow();
  });

  test('delete([ids]) bypasses callbacks and just emits DELETE', async () => {
    const a = await Topic.create({ title: 'a' });
    const b = await Topic.create({ title: 'b' });
    const n = await Topic.delete([a.id, b.id]);
    expect(n).toBe(2);
    expect(await Topic.count()).toBe(0);
  });

  test('increment attribute', async () => {
    const t = await Topic.create({ title: 'a', replies_count: 5 });
    t.increment('replies_count');
    expect(t.readAttribute('replies_count')).toBe(6);
    t.increment('replies_count', 4);
    expect(t.readAttribute('replies_count')).toBe(10);
  });

  test('decrement attribute', async () => {
    const t = await Topic.create({ title: 'a', replies_count: 5 });
    t.decrement('replies_count');
    expect(t.readAttribute('replies_count')).toBe(4);
    t.decrement('replies_count', 2);
    expect(t.readAttribute('replies_count')).toBe(2);
  });

  test('incrementSave persists the change', async () => {
    const t = await Topic.create({ title: 'a', replies_count: 1 });
    await t.incrementSave('replies_count', 3);
    const reloaded = await Topic.find(t.id);
    expect(reloaded.readAttribute('replies_count')).toBe(4);
  });

  test('increment on a new record updates in-memory only', async () => {
    const t = new Topic({ title: 'fresh' });
    t.increment('replies_count');
    expect(t.readAttribute('replies_count')).toBe(1);
    expect(t.persisted).toBe(false);
  });

  test.skip('increment with :touch updates timestamps (TODO: increment+touch)', () => {});

  test('becomes converts to another subclass preserving attributes + status', async () => {
    class Employee extends Topic {}
    class Manager extends Employee {}
    Employee.useConnection(fx.adapter);
    Manager.useConnection(fx.adapter);
    await Employee.loadSchema();
    await Manager.loadSchema();
    const e = await Employee.create({ title: 'alice' });
    const m = e.becomes(Manager);
    expect(m).toBeInstanceOf(Manager);
    expect(m.readAttribute('title')).toBe('alice');
    expect(m.persisted).toBe(true);
  });

  test('becomes preserves errors', async () => {
    class A extends Topic {}
    class B extends Topic {}
    A.useConnection(fx.adapter);
    B.useConnection(fx.adapter);
    await A.loadSchema();
    await B.loadSchema();
    const a = new A({ title: 'x' });
    a.errors.add('title', 'is bad');
    const b = a.becomes(B);
    expect(b.errors.on('title')).toEqual(['is bad']);
  });

  test('STI: instantiate dispatches to registered subclass via inheritance column', async () => {
    class Article extends Topic {}
    class Newsflash extends Article {}
    Article.useConnection(fx.adapter);
    Newsflash.useConnection(fx.adapter);
    Newsflash.stiAs('Newsflash');
    await Article.loadSchema();
    await Newsflash.loadSchema();
    await Newsflash.create({ title: 'breaking', type: 'Newsflash' });
    // Querying via the parent should hydrate as the registered subclass.
    const rows = await Article.where({ type: 'Newsflash' });
    expect(rows[0]).toBeInstanceOf(Newsflash);
  });

  test('STI: subclass autostamps inheritance column on insert', async () => {
    class A2 extends Topic {}
    class Specialist extends A2 {}
    A2.useConnection(fx.adapter);
    Specialist.useConnection(fx.adapter);
    Specialist.stiAs('Specialist');
    await A2.loadSchema();
    await Specialist.loadSchema();
    const s = await Specialist.create({ title: 'auto-typed' });
    expect(s.readAttribute('type')).toBe('Specialist');
  });

  test.skip('dup becomes persists changes (TODO: dup support)', () => {});
  test.skip('becomes_initializes_missing_attributes (TODO: missing attrs)', () => {});
});

describe('Persistence — reload + touch', () => {
  test('reload restores in-memory changes from the DB', async () => {
    const t = await Topic.create({ title: 'original' });
    t.writeAttribute('title', 'pending');
    await t.reload();
    expect(t.readAttribute('title')).toBe('original');
  });

  test('touch updates updated_at and persists', async () => {
    const t = await Topic.create({ title: 'a' });
    const before = t.readAttribute('updated_at');
    await new Promise((r) => setTimeout(r, 10));
    await t.touch();
    const after = t.readAttribute('updated_at');
    expect(after).not.toBe(before);
    expect((after as Date).getTime()).toBeGreaterThanOrEqual((before as Date | null)?.getTime() ?? 0);
  });

  test('touch with specific columns', async () => {
    const t = await Topic.create({ title: 'a' });
    await t.touch('updated_at');
    expect(t.readAttribute('updated_at')).toBeInstanceOf(Date);
  });

  test.skip('touch_all on a relation (TODO: relation-level touch)', () => {});
});

describe('Persistence — assignment', () => {
  test('assignAttributes batch-applies values', () => {
    const t = new Topic();
    t.assignAttributes({ title: 'x', author_name: 'y' });
    expect(t.readAttribute('title')).toBe('x');
    expect(t.readAttribute('author_name')).toBe('y');
  });

  test.skip('assign_attributes raises for unknown attribute (TODO: strict mode)', () => {});
});
