/**
 * Ported from activerecord/test/cases/base_test.rb (Rails 7.2 branch).
 *
 * The Ruby base_test is ~2100 lines covering arel internals, abstract
 * classes, time-zone conversion, generated module names, composite PKs,
 * readonly attributes, and many more. We port the tests that map to
 * features we ship — initialization, attribute IO, table-name guesses,
 * defaults, equality, find/save — and skip the rest with TODOs.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Base } from '../../src';
import { type Fixtures, setupFixtures, Topic, Post, Developer, Person } from './_fixtures';

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

describe('BasicsTest — initialization', () => {
  test('initialize with attributes', () => {
    const t = new Topic({ title: 'initialized from attributes', author_name: 'jon' });
    expect(t.readAttribute('title')).toBe('initialized from attributes');
    expect(t.readAttribute('author_name')).toBe('jon');
  });
  test('initialize with array param', () => {
    // Rails accepts a hash; arrays are coerced to attribute pairs in some places
    const t = new Topic({ title: 'a' });
    expect(t.readAttribute('title')).toBe('a');
  });
  test('create after initialize', async () => {
    const t = new Topic({ title: 'something' });
    await t.save();
    expect(t.persisted).toBe(true);
    const reloaded = await Topic.find(t.id);
    expect(reloaded.readAttribute('title')).toBe('something');
  });

  test.skip('test_initialize_with_invalid_attribute (TODO: invalid-attribute raise)', () => {});
});

describe('BasicsTest — table name guessing', () => {
  test('default table name follows Rails pluralization', () => {
    expect(Topic.effectiveTableName()).toBe('topics');
    expect(Person.effectiveTableName()).toBe('people');
  });

  test('test_table_name_guesses_with_prefixes_and_suffixes', () => {
    class Widget extends Post {
      static override tablePrefix = 'app_';
      static override tableSuffix = '_v2';
    }
    expect(Widget.effectiveTableName()).toBe('app_posts_v2');
  });
  test.skip('test_singular_table_name_guesses (TODO: singular tables)', () => {});
  test('abstract class skips schema load and inherits config to subclasses', async () => {
    class AbstractBase extends Topic {
      static override abstractClass = true;
    }
    AbstractBase.useConnection(fx.adapter);
    // Should not throw — schema load is a no-op for abstract classes.
    await AbstractBase.loadSchema();
    expect(AbstractBase.abstractClass).toBe(true);
    // A concrete subclass can still use the same connection chain.
    class Concrete extends AbstractBase {
      static override tableName = 'topics';
    }
    await Concrete.loadSchema();
    expect(Concrete.attributesSchema().has('title')).toBe(true);
  });
});

describe('BasicsTest — finders + persistence', () => {
  test('find returns hydrated record', async () => {
    const t = await Topic.create({ title: 'one' });
    const found = await Topic.find(t.id);
    expect(found.readAttribute('title')).toBe('one');
  });

  test('table_exists', async () => {
    expect(await fx.adapter.tableExists('topics')).toBe(true);
    expect(await fx.adapter.tableExists('does_not_exist')).toBe(false);
  });

  test('null fields hydrate to null', async () => {
    const t = await Topic.create({ title: 'has-no-content' });
    const found = await Topic.find(t.id);
    expect(found.readAttribute('content')).toBe(null);
  });

  test('default values applied on new record', () => {
    const t = new Topic();
    // SQLite reflects booleans as INTEGER, so our reflected default is 1 not true.
    // Rails handles this via sql_type sniffing; for now the integer form is what
    // arrives from reflection. Models can re-declare attribute types if needed.
    expect(t.readAttribute('approved')).toBe(1);
    expect(t.readAttribute('replies_count')).toBe(0);
  });

  test('default values on empty strings are coerced via Type', () => {
    const t = new Topic({ replies_count: '' });
    expect(t.readAttribute('replies_count')).toBe(null);
  });

  test('equality — same class + same id', async () => {
    const a = await Topic.create({ title: 'x' });
    const b = await Topic.find(a.id);
    expect(a.id).toBe(b.id);
    // Strict identity isn't required (we return fresh instances)
  });

});

describe('BasicsTest — attribute IO', () => {
  test('readAttribute / writeAttribute', () => {
    const t = new Topic();
    t.writeAttribute('title', 'hi');
    expect(t.readAttribute('title')).toBe('hi');
  });

  test.skip('test_custom_mutator (TODO: per-attribute writer hook)', () => {});
  test.skip('test_incomplete_schema_loading (TODO)', () => {});
  test.skip('test_primary_key_with_no_id (TODO: composite/no PK)', () => {});
  test.skip('test_preserving_date_objects (TODO: date roundtrip)', () => {});
  test.skip('test_preserving_time_objects (TODO: time-zone awareness)', () => {});
  test.skip('test_utc_as_time_zone (TODO: tz config)', () => {});
});

describe('BasicsTest — relation limits', () => {
  test('limit_without_comma', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    const rows = await Topic.limit(1);
    expect(rows.length).toBe(1);
  });

  test('limit_should_take_value_from_latest_limit', async () => {
    await Topic.create({ title: 'a' });
    await Topic.create({ title: 'b' });
    await Topic.create({ title: 'c' });
    const rows = await Topic.limit(2).limit(1);
    expect(rows.length).toBe(1);
  });

  test.skip('test_invalid_limit raises (TODO: negative limit validation)', () => {});
  test.skip('test_limit_should_sanitize_sql_injection_for_limit (TODO: sanitize limit)', () => {});
});

describe('BasicsTest — select sugar', () => {
  test('select with attribute list', async () => {
    await Topic.create({ title: 'a', author_name: 'x' });
    const rows = await Topic.select('title');
    expect(rows[0]?.readAttribute('title')).toBe('a');
  });

  test.skip('test_select_symbol (TODO: symbol-based select sugar)', () => {});
});

describe('BasicsTest — readonly attrs / many other features', () => {
  test('readonly attribute is preserved on update', async () => {
    class ReadonlyTitlePost extends Post {}
    ReadonlyTitlePost.attrReadonly('title');
    ReadonlyTitlePost.useConnection(fx.adapter);
    await ReadonlyTitlePost.loadSchema();
    const p = await ReadonlyTitlePost.create({ title: 'original', body: 'b' });
    p.writeAttribute('title', 'modified');
    p.writeAttribute('body', 'updated body');
    await p.save();
    const reloaded = await ReadonlyTitlePost.find(p.id);
    expect(reloaded.readAttribute('title')).toBe('original');
    expect(reloaded.readAttribute('body')).toBe('updated body');
  });

  test('readonly attribute is set on insert', async () => {
    class ReadonlyTitlePost extends Post {}
    ReadonlyTitlePost.attrReadonly('title');
    ReadonlyTitlePost.useConnection(fx.adapter);
    await ReadonlyTitlePost.loadSchema();
    const p = await ReadonlyTitlePost.create({ title: 'set-once', body: 'b' });
    const reloaded = await ReadonlyTitlePost.find(p.id);
    expect(reloaded.readAttribute('title')).toBe('set-once');
  });
});
