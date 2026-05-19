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
beforeAll(async () => {
  fx = await setupFixtures();
});
afterAll(async () => {
  await fx.teardown();
});
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

  test('to_sql produces parameterized SQL', async () => {
    const [sql, binds] = Topic.where({ author_name: 'one' }).order({ title: 'asc' }).limit(5).toSql();
    expect(sql).toMatch(/SELECT/);
    expect(sql).toMatch(/FROM "topics"/);
    expect(sql).toMatch(/WHERE/);
    expect(sql).toMatch(/ORDER BY/);
    expect(sql).toMatch(/LIMIT/);
    expect(binds).toEqual(['one']);
  });

  test('merge two relations', async () => {
    const a = Topic.where({ author_name: 'one' });
    const b = Topic.where({ title: 'A' });
    const rows = await a.merge(b);
    expect(rows.length).toBe(1);
    expect(rows[0]?.readAttribute('author_name')).toBe('one');
  });

  test('unscope drops a clause', async () => {
    const rows = await Topic.where({ author_name: 'one' }).order({ title: 'desc' }).unscope('where');
    expect(rows.length).toBe(3);
  });

  test('or combines two scopes via OR', async () => {
    const a = Topic.where({ author_name: 'one' });
    const b = Topic.where({ author_name: 'two' });
    const rows = await a.or(b).order({ title: 'asc' });
    expect(rows.map((r) => r.readAttribute('title'))).toEqual(['A', 'B']);
  });

  test('none returns an empty relation that never executes', async () => {
    const rows = await Topic.all().none();
    expect(rows).toEqual([]);
  });

  test('rewhere replaces an existing where on same attribute', async () => {
    const rows = await Topic.where({ author_name: 'one' }).rewhere({ author_name: 'two' });
    expect(rows.length).toBe(1);
    expect(rows[0]?.readAttribute('author_name')).toBe('two');
  });

  test('reverse_order flips current orders', async () => {
    const rows = await Topic.order({ title: 'asc' }).reverseOrder();
    expect(rows.map((r) => r.readAttribute('title'))).toEqual(['C', 'B', 'A']);
  });

  test('only keeps just the named clauses', async () => {
    const rel = Topic.where({ author_name: 'one' }).order({ title: 'desc' }).limit(1).only('where');
    const rows = await rel;
    expect(rows.length).toBe(1);
    expect(rows[0]?.readAttribute('author_name')).toBe('one');
  });

  test('except drops the listed clauses', async () => {
    const rows = await Topic.order({ title: 'desc' }).except('order');
    expect(rows.length).toBe(3);
  });

  test('scope: named scope registers as a static method', async () => {
    class Scoped extends Topic {}
    Scoped.useConnection(fx.adapter);
    await Scoped.loadSchema();
    Scoped.scope('byAuthor', (name: string) => Scoped.where({ author_name: name }));
    const rows = await (Scoped as unknown as { byAuthor: (n: string) => Promise<Scoped[]> }).byAuthor('one');
    expect(rows.length).toBe(1);
    expect(rows[0]?.readAttribute('title')).toBe('A');
  });

  test('scope returns a Relation and is chainable', async () => {
    class Scoped2 extends Topic {}
    Scoped2.useConnection(fx.adapter);
    await Scoped2.loadSchema();
    Scoped2.scope('ordered', () => Scoped2.order({ title: 'desc' }));
    const top = await (Scoped2 as unknown as { ordered: () => { limit: (n: number) => Promise<Scoped2[]> } })
      .ordered()
      .limit(2);
    expect(top.map((r) => r.readAttribute('title'))).toEqual(['C', 'B']);
  });
  test('extending adds methods onto the returned Relation', async () => {
    const scope = Topic.all().extending({
      titles: async function (this: { toArray: () => Promise<Topic[]> }) {
        return (await this.toArray()).map((t) => t.readAttribute('title'));
      },
    });
    const names = await scope.titles();
    expect(names.sort()).toEqual(['A', 'B', 'C']);
  });
  test('group + having combination', async () => {
    const result = (await Topic.all().group('author_name').having(['COUNT(*) >= ?', 1]).count()) as Map<
      unknown,
      number
    >;
    expect(result.size).toBeGreaterThan(0);
  });

  // joins / includes / preload covered in associations_test.ts now that the
  // surface exists — these slot-level skips remain for the more nuanced
  // variants we haven't implemented yet.
  // left_outer_joins covered in associations_test.ts
  // references / eager_load now exposed — see annotate/references tests above
  // and the leftOuterJoins / eagerLoad cases in associations_test.ts.

  test('lock("FOR UPDATE") is chainable (SQLite suppresses the clause; PG/MySQL emit it)', async () => {
    // SQLite's arel visitor intentionally drops lock fragments since SQLite
    // doesn't support them. We verify the chain works and the relation
    // resolves; rendered SQL is dialect-specific.
    const rows = await Topic.all().lock('FOR UPDATE');
    expect(rows.length).toBe(3);
  });

  test('lock(true) is chainable and defaults to FOR UPDATE-like semantics', async () => {
    const rows = await Topic.all().lock();
    expect(rows.length).toBe(3);
  });

  test('readonly relation prevents save', async () => {
    const { ReadOnlyRecord } = await import('../../src');
    await Topic.create({ title: 'frozen' });
    const records = await Topic.all().readonly();
    const r = records[0]!;
    r.writeAttribute('title', 'modified');
    await expect(r.save()).rejects.toBeInstanceOf(ReadOnlyRecord);
  });

  test('annotate appends a SQL comment to the query', async () => {
    const [sql] = Topic.annotate('reason: nightly job').toSql();
    expect(sql).toMatch(/reason: nightly job/);
  });

  test('strictLoading is a chainable no-op for now', async () => {
    // Hook is recorded on the relation; actual access enforcement is TODO.
    const rows = await Topic.strictLoading();
    expect(rows.length).toBe(3);
  });

  test('references is chainable (currently informational)', async () => {
    const rows = await Topic.references('users');
    expect(rows.length).toBe(3);
  });
});

describe('Relations — none', () => {
  test('none() returns an empty relation', async () => {
    const rows = await Topic.all().none();
    expect(rows).toEqual([]);
  });
});
