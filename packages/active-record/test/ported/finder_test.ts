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

  test.skip('find with multiple ids returns array (TODO: find(1, 2, 3))', () => {});
  test.skip('find with array of ids (TODO)', () => {});
  test.skip('find with ids preserves order (TODO)', () => {});
  test.skip('find with string id (TODO: numeric-coercion of string ids)', () => {});

  test.skip('find_by_id with hash (TODO: dynamic finder)', () => {});
  test.skip('find_by_title_and_id_with_hash (TODO: dynamic finder)', () => {});
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

  test.skip('exists with id argument (TODO: exists(id))', () => {});
  test.skip('exists with string condition (TODO: raw sql arg)', () => {});
  test.skip('exists with order (TODO)', () => {});
  test.skip('exists with distinct + offset + joins (TODO: joins)', () => {});
  test.skip('exists with eager_load / includes (TODO: eager load)', () => {});
  test.skip('exists with polymorphic relation (TODO: polymorphic)', () => {});
  test.skip('exists with left_joins (TODO: joins)', () => {});
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

  test.skip('where with not (TODO: where.not chain)', () => {});
  test.skip('where with range / Date span (TODO: range)', () => {});
  test.skip('where with belongs_to association (TODO: associations)', () => {});
});
