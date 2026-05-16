/**
 * Ported from activerecord/test/cases/relations_test.rb (Rails 7.2 branch).
 *
 * Rails relations_test is ~2800 lines covering merge/unscope/none/or,
 * scope_for_create, association joins, includes, references,
 * group_by, optimizer hints, batches, eager loading. We port the core
 * chainable surface (where/order/limit/offset/select/distinct/pluck/
 * count). Everything that needs joins/associations or scope mutation
 * helpers is skipped.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { type Fixtures, setupFixtures, Topic } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => { fx = await setupFixtures(); });
afterAll(async () => { await fx.teardown(); });
beforeEach(async () => {
  await fx.reset();
  await Topic.create({ title: 'A', author_name: 'one' });
  await Topic.create({ title: 'B', author_name: 'two' });
  await Topic.create({ title: 'C', author_name: 'three' });
});

describe('Relations — chainable', () => {
  test('all returns a Relation that resolves to every record', async () => {
    expect((await Topic.all()).length).toBe(3);
  });

  test('where then order', async () => {
    const rows = await Topic.where({ author_name: ['one', 'two'] }).order({ title: 'desc' });
    expect(rows.map((r) => r.readAttribute('title'))).toEqual(['B', 'A']);
  });

  test('limit + offset paginate', async () => {
    const page1 = await Topic.order({ title: 'asc' }).limit(2);
    const page2 = await Topic.order({ title: 'asc' }).limit(2).offset(2);
    expect(page1.map((r) => r.readAttribute('title'))).toEqual(['A', 'B']);
    expect(page2.map((r) => r.readAttribute('title'))).toEqual(['C']);
  });

  test('select projects specific columns', async () => {
    const rows = await Topic.select('title');
    expect(rows.length).toBe(3);
    expect(rows[0]?.readAttribute('title')).toBe('A');
  });

  test('distinct removes duplicates', async () => {
    await Topic.create({ title: 'A', author_name: 'four' });
    const rows = await Topic.select('title').distinct().order({ title: 'asc' });
    const titles = rows.map((r) => r.readAttribute('title'));
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('pluck single column', async () => {
    const titles = await Topic.order({ title: 'asc' }).pluck<string>('title');
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  test('reorder replaces previous order', async () => {
    const rows = await Topic.order({ title: 'asc' }).reorder({ title: 'desc' });
    expect(rows.map((r) => r.readAttribute('title'))).toEqual(['C', 'B', 'A']);
  });

  test('relation is thenable — await works directly', async () => {
    const rows = await Topic.where({ author_name: 'one' });
    expect(rows.length).toBe(1);
  });

  test('count on a relation respects where', async () => {
    expect(await Topic.where({ author_name: 'one' }).count()).toBe(1);
    expect(await Topic.count()).toBe(3);
  });

  test('exists on a relation', async () => {
    expect(await Topic.where({ author_name: 'one' }).exists()).toBe(true);
    expect(await Topic.where({ author_name: 'nope' }).exists()).toBe(false);
  });

  test.skip('to_sql produces parameterized SQL (TODO: structural toSql snapshot)', () => {});

  test.skip('merge two relations (TODO: merge)', () => {});
  test.skip('unscope drops a clause (TODO: unscope)', () => {});
  test.skip('or combines two scopes (TODO: or)', () => {});
  test.skip('none returns an empty relation that never executes (TODO: verify SQL skip)', () => {});
  test.skip('rewhere replaces an existing where (TODO: rewhere)', () => {});
  test.skip('reverse_order (TODO: reverseOrder)', () => {});
  test.skip('only/except (TODO: filter relation values)', () => {});
  test.skip('extending (TODO)', () => {});
  test.skip('group + having (TODO: group/having combinations)', () => {});
  test.skip('scope_for_create / new from scope (TODO: scope)', () => {});

  test.skip('joins inner (TODO: joins / associations)', () => {});
  test.skip('left_outer_joins (TODO: joins)', () => {});
  test.skip('includes for eager-load (TODO: eager load)', () => {});
  test.skip('preload (TODO: associations)', () => {});
  test.skip('references (TODO: associations)', () => {});
  test.skip('eager_load explicit (TODO: eager load)', () => {});

  test.skip('lock(:for_update) (TODO: locking SQL)', () => {});
  test.skip('readonly (TODO: readonly relation)', () => {});
  test.skip('annotate (TODO: SQL comment)', () => {});
  test.skip('strict_loading (TODO)', () => {});
});

describe('Relations — none', () => {
  test('none() returns an empty relation', async () => {
    const rows = await Topic.all().none();
    expect(rows).toEqual([]);
  });
});
