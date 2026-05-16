/**
 * Ported from activerecord/test/cases/calculations_test.rb (Rails 7.2 branch).
 *
 * Rails calculations_test is ~1750 lines covering count/sum/avg/minimum/
 * maximum with groupings, distinct, associations, custom selects, and a
 * lot of DB-dialect-specific edge cases. We support `count` and `pluck`
 * directly; the rest is `test.skip` until we add `sum/min/max/average`
 * and `group` aggregations on Relation.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { type Fixtures, setupFixtures, Developer } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => { fx = await setupFixtures(); });
afterAll(async () => { await fx.teardown(); });
beforeEach(async () => {
  await fx.reset();
  await Developer.create({ name: 'David', salary: 80000 });
  await Developer.create({ name: 'Jamis', salary: 150000 });
  await Developer.create({ name: 'Hampton', salary: 100000 });
  await Developer.create({ name: 'Sam', salary: 100000 });
});

describe('Calculations — count', () => {
  test('count returns total row count', async () => {
    expect(await Developer.count()).toBe(4);
  });

  test('count with where', async () => {
    expect(await Developer.where({ salary: 100000 }).count()).toBe(2);
  });

  test('count with explicit column', async () => {
    expect(await Developer.count('name')).toBe(4);
  });
});

describe('Calculations — pluck', () => {
  test('pluck single column', async () => {
    const names = await Developer.order({ name: 'asc' }).pluck<string>('name');
    expect(names).toEqual(['David', 'Hampton', 'Jamis', 'Sam']);
  });

  test('pluck multiple columns', async () => {
    const rows = await Developer.order({ name: 'asc' }).pluck<[string, number]>('name', 'salary');
    expect(rows[0]).toEqual(['David', 80000]);
  });

  test('pluck on a where scope', async () => {
    const names = await Developer.where({ salary: 100000 }).order({ name: 'asc' }).pluck<string>('name');
    expect(names).toEqual(['Hampton', 'Sam']);
  });

  test('ids shorthand', async () => {
    const ids = await Developer.ids();
    expect(ids.length).toBe(4);
  });
});

describe('Calculations — aggregates (sum/avg/min/max)', () => {
  test.skip('sum (TODO: sum aggregate)', () => {});
  test.skip('sum on a scope (TODO)', () => {});
  test.skip('sum with grouping (TODO: group aggregates)', () => {});
  test.skip('average (TODO: avg)', () => {});
  test.skip('minimum (TODO: min)', () => {});
  test.skip('maximum (TODO: max)', () => {});
});

describe('Calculations — grouping', () => {
  test.skip('count with group_by (TODO: groupCounts)', () => {});
  test.skip('group on multiple columns (TODO)', () => {});
  test.skip('group then count (TODO)', () => {});
  test.skip('count_with_column_select (TODO)', () => {});
  test.skip('count_with_distinct (TODO: count + distinct)', () => {});
});

describe('Calculations — special', () => {
  test.skip('count with order ignored (TODO)', () => {});
  test.skip('count_after_pluck (TODO)', () => {});
  test.skip('sum with from-clause (TODO)', () => {});
  test.skip('count with includes (TODO: includes)', () => {});
  test.skip('select_count_with_having (TODO)', () => {});
  test.skip('count_with_block (TODO: ruby block count)', () => {});
});
