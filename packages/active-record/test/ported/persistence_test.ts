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
  test.skip('destroy_many / destroy_many_with_invalid_id (TODO: destroy by ids)', () => {});
  test.skip('delete_many (TODO: delete by ids)', () => {});

  test.skip('increment attribute / decrement attribute (TODO: increment/decrement)', () => {});
  test.skip('increment with :touch (TODO: touch)', () => {});
  test.skip('increment new record raises (TODO)', () => {});
  test.skip('increment destroyed record raises (TODO)', () => {});

  test.skip('becomes converts STI subclass (TODO: STI)', () => {});
  test.skip('becomes after reload_schema_from_cache (TODO)', () => {});
  test.skip('becomes preserves errors / status (TODO)', () => {});
  test.skip('dup becomes persists changes (TODO)', () => {});
  test.skip('becomes_initializes_missing_attributes (TODO)', () => {});
});

describe('Persistence — reload + touch', () => {
  test('reload restores in-memory changes from the DB', async () => {
    const t = await Topic.create({ title: 'original' });
    t.writeAttribute('title', 'pending');
    await t.reload();
    expect(t.readAttribute('title')).toBe('original');
  });

  test.skip('touch updates updated_at without touching other columns (TODO: touch + updated_at schema)', () => {});
  test.skip('touch with specific columns (TODO)', () => {});
  test.skip('touch_all on a relation (TODO)', () => {});
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
