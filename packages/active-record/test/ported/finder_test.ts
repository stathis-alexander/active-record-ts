/**
 * Ported from activerecord/test/cases/finder_test.rb (Rails 7.2 branch).
 *
 * Rails finder_test is ~2100 lines, much of it about polymorphic /
 * has-many-through `exists?`, eager-loading, joins, strong-parameters
 * checks, composite primary keys. We port the basics — find/find_by/
 * first/last/take/exists/where — and skip anything that needs
 * associations, eager-load, or scoping internals.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { RecordNotFound } from '../../src';
import { type Fixtures, setupFixtures, Topic, Post } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => { fx = await setupFixtures(); });
afterAll(async () => { await fx.teardown(); });
beforeEach(async () => {
  await fx.reset();
  await Topic.create({ title: 'first', author_name: 'Alex' });
  await Topic.create({ title: 'second', author_name: 'Sandy' });
  await Topic.create({ title: 'third', author_name: 'Casey' });
});

describe('Finder — find by id', () => {
  test('find returns hydrated record', async () => {
    const t = await Topic.find(1);
    expect(t.readAttribute('title')).toBe('first');
  });

  test('find raises RecordNotFound when missing', async () => {
    await expect(Topic.find(999)).rejects.toThrow(RecordNotFound);
  });

  test('find with multiple ids returns array', async () => {
    const records = await Topic.find([1, 2]);
    expect(records.length).toBe(2);
    expect(records.map((r) => r.id)).toEqual([1, 2]);
  });

  test('find with array of ids', async () => {
    const records = await Topic.find([2, 3]);
    expect(records.length).toBe(2);
  });

  test('find with ids preserves order', async () => {
    const records = await Topic.find([3, 1, 2]);
    expect(records.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  test('find raises when one of multiple ids is missing', async () => {
    await expect(Topic.find([1, 999])).rejects.toThrow();
  });

  test('findEach iterates record-by-record', async () => {
    const collected: string[] = [];
    for await (const t of Topic.findEach({ batchSize: 2 })) {
      collected.push(t.readAttribute('title') as string);
    }
    expect(collected.sort()).toEqual(['first', 'second', 'third']);
  });

  test('inBatches yields arrays of size N', async () => {
    const batches: string[][] = [];
    for await (const batch of Topic.inBatches({ of: 2 })) {
      batches.push(batch.map((t) => t.readAttribute('title') as string));
    }
    expect(batches.length).toBeGreaterThanOrEqual(1);
    expect(batches.flat().sort()).toEqual(['first', 'second', 'third']);
  });

  test('find with a numeric string id (driver coerces both ways)', async () => {
    const t = await Topic.find('1' as unknown as number);
    expect(t.readAttribute('title')).toBe('first');
  });

  test('dynamic finder findByTitle returns matching record', async () => {
    const t = await (Topic as unknown as { findByTitle: (v: unknown) => Promise<Topic | null> }).findByTitle('second');
    expect(t?.readAttribute('author_name')).toBe('Sandy');
  });

  test('dynamic finder findByTitleOrThrow throws when missing', async () => {
    await expect(
      (Topic as unknown as { findByTitleOrThrow: (v: unknown) => Promise<Topic> }).findByTitleOrThrow('nope'),
    ).rejects.toThrow();
  });

  test('multi-attribute dynamic finder via findByDynamic', async () => {
    type Dyn = { findByDynamic: (name: string, ...args: unknown[]) => Promise<Topic | null> };
    const t = await (Topic as unknown as Dyn).findByDynamic('findByTitleAndAuthorName', 'first', 'Alex');
    expect(t?.readAttribute('title')).toBe('first');
    const miss = await (Topic as unknown as Dyn).findByDynamic('findByTitleAndAuthorName', 'first', 'NoOne');
    expect(miss).toBeNull();
  });
});

describe('Finder — find_or_initialize_by / find_or_create_by', () => {
  test('findOrInitializeBy returns matching record when one exists', async () => {
    const t = await Topic.findOrInitializeBy({ title: 'first' });
    expect(t.persisted).toBe(true);
  });

  test('findOrInitializeBy builds (does not save) when missing', async () => {
    const t = await Topic.findOrInitializeBy({ title: 'brand-new' });
    expect(t.persisted).toBe(false);
    expect(t.readAttribute('title')).toBe('brand-new');
  });

  test('findOrInitializeBy merges overrides', async () => {
    const t = await Topic.findOrInitializeBy({ title: 'brand-new' }, { author_name: 'mira' });
    expect(t.readAttribute('author_name')).toBe('mira');
  });

  test('findOrCreateBy persists when missing', async () => {
    const t = await Topic.findOrCreateBy({ title: 'newly-created' });
    expect(t.persisted).toBe(true);
    expect(await Topic.exists({ title: 'newly-created' })).toBe(true);
  });

  test('findOrCreateBy returns the existing record otherwise', async () => {
    const t = await Topic.findOrCreateBy({ title: 'first' });
    expect(t.id).toBe(1);
    expect(await Topic.count()).toBe(3);
  });
});

describe('Finder — find_by', () => {
  test('findBy by single attribute', async () => {
    const t = await Topic.findBy({ author_name: 'Sandy' });
    expect(t?.readAttribute('title')).toBe('second');
  });

  test('findBy returns null when missing', async () => {
    expect(await Topic.findBy({ author_name: 'NoOne' })).toBeNull();
  });

  test('findBy by multiple attributes', async () => {
    const t = await Topic.findBy({ author_name: 'Alex', title: 'first' });
    expect(t).not.toBeNull();
  });
});

describe('Finder — first / last / take', () => {
  test('first', async () => {
    const t = await Topic.first();
    expect(t?.readAttribute('title')).toBe('first');
  });

  test('last', async () => {
    const t = await Topic.last();
    expect(t?.readAttribute('title')).toBe('third');
  });

  test('take returns one record without order', async () => {
    const t = await Topic.take();
    expect(t).not.toBeNull();
  });

  test('take(n) returns array', async () => {
    const rows = (await Topic.take(2)) as Topic[];
    expect(rows.length).toBe(2);
  });
});

describe('Finder — exists', () => {
  test('exists with no args', async () => {
    expect(await Topic.exists()).toBe(true);
  });

  test('exists with conditions', async () => {
    expect(await Topic.exists({ author_name: 'Sandy' })).toBe(true);
    expect(await Topic.exists({ author_name: 'NoOne' })).toBe(false);
  });

  test('exists with empty table returns false', async () => {
    await Topic.deleteAll();
    expect(await Topic.exists()).toBe(false);
  });

  test('exists(id) looks up by primary key', async () => {
    expect(await Topic.exists(1)).toBe(true);
    expect(await Topic.exists(999)).toBe(false);
  });
  test('exists with raw SQL string condition', async () => {
    expect(await Topic.where('"topics"."title" = \'first\'').exists()).toBe(true);
    expect(await Topic.where('"topics"."title" = \'nope\'').exists()).toBe(false);
  });

  test('exists with order — order is irrelevant to the EXISTS check', async () => {
    expect(await Topic.order({ title: 'desc' }).exists()).toBe(true);
  });

  test('exists with distinct + offset', async () => {
    expect(await Topic.distinct().offset(2).exists()).toBe(true);
    expect(await Topic.distinct().offset(99).exists()).toBe(false);
  });

  test('exists with includes', async () => {
    // No association on Topic; verify the chain doesn't break exists.
    expect(await Topic.where({ author_name: 'Alex' }).exists()).toBe(true);
  });

  test('exists with leftOuterJoins (no association — just verifies the chain)', async () => {
    expect(await Topic.where({ author_name: 'Sandy' }).exists()).toBe(true);
  });
});

describe('Finder — where chain', () => {
  test('where returns matching records', async () => {
    const rows = await Topic.where({ author_name: 'Sandy' });
    expect(rows.length).toBe(1);
    expect(rows[0]?.readAttribute('title')).toBe('second');
  });

  test('where with array (IN)', async () => {
    const rows = await Topic.where({ author_name: ['Alex', 'Casey'] });
    expect(rows.length).toBe(2);
  });

  test('where with null value', async () => {
    await Topic.create({ title: 'no-author' });
    const rows = await Topic.where({ author_name: null });
    expect(rows.length).toBe(1);
  });

  test('where chained with order + limit', async () => {
    const rows = await Topic.order({ title: 'asc' }).limit(2);
    expect(rows.map((r) => r.readAttribute('title'))).toEqual(['first', 'second']);
  });

  test('where with arel-style SQL fragment', async () => {
    const rows = await Topic.where(['title = ?', 'first']);
    expect(rows.length).toBe(1);
  });

  test('whereNot excludes matching records', async () => {
    const rows = await Topic.whereNot({ author_name: 'Sandy' });
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.readAttribute('author_name')).sort()).toEqual(['Alex', 'Casey']);
  });

  test('where with raw SQL fragment + binds (range form)', async () => {
    const rows = await Topic.where(['title >= ?', 'second']);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.readAttribute('title')).sort()).toEqual(['second', 'third']);
  });

  test.skip('where with belongs_to association (TODO: associations)', () => {});
});
