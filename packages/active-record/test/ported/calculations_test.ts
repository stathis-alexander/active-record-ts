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
  test('sum returns total of column', async () => {
    expect(await Developer.sum('salary')).toBe(430000);
  });

  test('sum on a where scope', async () => {
    expect(await Developer.where({ salary: 100000 }).sum('salary')).toBe(200000);
  });

  test.skip('sum with grouping (TODO: group aggregates)', () => {});

  test('average returns mean of column', async () => {
    expect(await Developer.average('salary')).toBe(107500);
  });

  test('minimum returns the smallest value', async () => {
    expect(await Developer.minimum('salary')).toBe(80000);
  });

  test('maximum returns the largest value', async () => {
    expect(await Developer.maximum('salary')).toBe(150000);
  });

  test('average/min/max on empty scope return null', async () => {
    await fx.reset();
    expect(await Developer.average('salary')).toBeNull();
    expect(await Developer.minimum('salary')).toBeNull();
    expect(await Developer.maximum('salary')).toBeNull();
  });

  test('sum on empty scope returns 0', async () => {
    await fx.reset();
    expect(await Developer.sum('salary')).toBe(0);
  });
});

describe('Calculations — grouping', () => {
  test('count grouped by a column returns a Map<key, n>', async () => {
    const result = await Developer.all().group('salary').count() as Map<unknown, number>;
    expect(result.get(100000)).toBe(2);
    expect(result.get(80000)).toBe(1);
    expect(result.get(150000)).toBe(1);
  });

  test('sum grouped by a column', async () => {
    const result = await Developer.all().group('salary').sum('salary') as Map<unknown, number>;
    expect(result.get(100000)).toBe(200000);
    expect(result.get(80000)).toBe(80000);
  });

  test('group + average', async () => {
    const result = await Developer.all().group('salary').average('salary') as Map<unknown, number>;
    expect(result.get(100000)).toBe(100000);
  });

  test('group on multiple columns — key is an array of group values', async () => {
    await Developer.create({ name: 'Z', salary: 100000 });
    const result = await Developer.all().group('salary', 'name').count() as Map<unknown, number>;
    // Find an entry with the [100000, 'Z'] composite key.
    let found = false;
    for (const [key, count] of result) {
      if (Array.isArray(key) && key[0] === 100000 && key[1] === 'Z' && count === 1) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('count({ distinct: true }) counts unique values', async () => {
    await Developer.create({ name: 'Z', salary: 100000 });   // duplicate salary
    expect(await Developer.count({ distinct: true, column: 'salary' })).toBe(3);
    expect(await Developer.count('salary')).toBe(5);
  });
});

describe('Calculations — special', () => {
  test.skip('count with order ignored (TODO)', () => {});
  test.skip('count_after_pluck (TODO)', () => {});
  test.skip('sum with from-clause (TODO)', () => {});
  test.skip('count with includes (TODO: includes)', () => {});
  test.skip('select_count_with_having (TODO)', () => {});
});
