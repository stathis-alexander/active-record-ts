/**
 * Ported from activerecord/test/cases/associations_test.rb (Rails 7.2 branch).
 *
 * The Rails associations test suite spans 50+ files and ~30k lines
 * covering belongs_to / has_many / has_one / polymorphic / has_many through /
 * autosave / counter cache / dependent / inverse_of / eager loading. We
 * focus on the slice we ship in PR A: declarative associations, lazy
 * accessors, FK inference, `dependent:` on owner destroy, and polymorphic
 * belongs_to/has_many.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Base } from '../../src';
import { type Fixtures, setupFixtures, Author, Post, Comment, Topic, Team, Membership } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => {
  fx = await setupFixtures();
});
afterAll(async () => {
  await fx.teardown();
});

describe('Associations — belongs_to', () => {
  class Article extends Post {}
  class Writer extends Author {}
  Article.belongsTo('author', { class: () => Writer, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Article.useConnection(fx.adapter);
    Writer.useConnection(fx.adapter);
    await Article.loadSchema();
    await Writer.loadSchema();
  });

  test('post.author resolves to the writer via author_id', async () => {
    const w = await Writer.create({ name: 'Alex' });
    const p = await Article.create({ title: 'hi', author_id: w.id as number });
    const found = await (p as unknown as { author: Promise<Writer | null> }).author;
    expect(found?.readAttribute('name')).toBe('Alex');
  });

  test('belongs_to returns null when FK is null', async () => {
    const p = await Article.create({ title: 'orphan' });
    expect(await (p as unknown as { author: Promise<Writer | null> }).author).toBeNull();
  });

  test('belongs_to returns null when FK does not match', async () => {
    const p = await Article.create({ title: 'missing', author_id: 999 });
    expect(await (p as unknown as { author: Promise<Writer | null> }).author).toBeNull();
  });
});

describe('Associations — has_many', () => {
  class Blog extends Author {}
  class Entry extends Post {}
  Blog.hasMany('entries', { class: () => Entry, foreignKey: 'author_id' });
  Entry.belongsTo('author', { class: () => Blog, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Blog.useConnection(fx.adapter);
    Entry.useConnection(fx.adapter);
    await Blog.loadSchema();
    await Entry.loadSchema();
  });

  test('user.posts returns a chainable Relation filtered by FK', async () => {
    const b = await Blog.create({ name: 'B' });
    await Entry.create({ title: 'a', author_id: b.id as number });
    await Entry.create({ title: 'b', author_id: b.id as number });
    await Entry.create({ title: 'unrelated' });
    const posts = await (b as unknown as { entries: Promise<Entry[]> }).entries;
    expect(posts.length).toBe(2);
    expect(posts.map((p) => p.readAttribute('title')).sort()).toEqual(['a', 'b']);
  });

  test('has_many Relation chains via where / order / limit', async () => {
    const b = await Blog.create({ name: 'B' });
    await Entry.create({ title: 'a', author_id: b.id as number });
    await Entry.create({ title: 'b', author_id: b.id as number });
    await Entry.create({ title: 'c', author_id: b.id as number });
    const entries = (
      b as unknown as { entries: { order: (...args: unknown[]) => { limit: (n: number) => Promise<Entry[]> } } }
    ).entries;
    const top2 = await entries.order({ title: 'desc' } as never).limit(2);
    expect(top2.map((p) => p.readAttribute('title'))).toEqual(['c', 'b']);
  });

  test('has_many returns an empty relation when the owner is unsaved', async () => {
    const b = new Blog({ name: 'unsaved' });
    const records = await (b as unknown as { entries: Promise<Entry[]> }).entries;
    expect(records).toEqual([]);
  });
});

describe('Associations — has_one', () => {
  class Owner extends Author {}
  class Profile extends Post {}
  Owner.hasOne('profile', { class: () => Profile, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Owner.useConnection(fx.adapter);
    Profile.useConnection(fx.adapter);
    await Owner.loadSchema();
    await Profile.loadSchema();
  });

  test('owner.profile returns the single record', async () => {
    const o = await Owner.create({ name: 'A' });
    await Profile.create({ title: 'bio', author_id: o.id as number });
    const p = await (o as unknown as { profile: Promise<Profile | null> }).profile;
    expect(p?.readAttribute('title')).toBe('bio');
  });

  test('owner.profile is null when none exists', async () => {
    const o = await Owner.create({ name: 'A' });
    expect(await (o as unknown as { profile: Promise<Profile | null> }).profile).toBeNull();
  });
});

describe('Associations — dependent: destroy / nullify / delete_all', () => {
  beforeEach(async () => {
    await fx.reset();
  });

  test('dependent: destroy invokes destroy on each owned record', async () => {
    class Owner1 extends Author {}
    class Item1 extends Post {}
    Owner1.useConnection(fx.adapter);
    Item1.useConnection(fx.adapter);
    Owner1.hasMany('items', { class: () => Item1, foreignKey: 'author_id', dependent: 'destroy' });
    let destroyed = 0;
    Item1.beforeDestroy(() => {
      destroyed++;
    });
    await Owner1.loadSchema();
    await Item1.loadSchema();
    const o = await Owner1.create({ name: 'A' });
    await Item1.create({ title: 'i1', author_id: o.id as number });
    await Item1.create({ title: 'i2', author_id: o.id as number });
    await o.destroy();
    expect(destroyed).toBe(2);
    expect(await Item1.count()).toBe(0);
  });

  test('dependent: delete_all issues one DELETE without firing destroy callbacks', async () => {
    class Owner2 extends Author {}
    class Item2 extends Post {}
    Owner2.useConnection(fx.adapter);
    Item2.useConnection(fx.adapter);
    Owner2.hasMany('items', { class: () => Item2, foreignKey: 'author_id', dependent: 'delete_all' });
    let fired = 0;
    Item2.beforeDestroy(() => {
      fired++;
    });
    await Owner2.loadSchema();
    await Item2.loadSchema();
    const o = await Owner2.create({ name: 'A' });
    await Item2.create({ title: 'i1', author_id: o.id as number });
    await o.destroy();
    expect(fired).toBe(0);
    expect(await Item2.count()).toBe(0);
  });

  test('dependent: nullify clears the FK without deleting', async () => {
    class Owner3 extends Author {}
    class Item3 extends Post {}
    Owner3.useConnection(fx.adapter);
    Item3.useConnection(fx.adapter);
    Owner3.hasMany('items', { class: () => Item3, foreignKey: 'author_id', dependent: 'nullify' });
    await Owner3.loadSchema();
    await Item3.loadSchema();
    const o = await Owner3.create({ name: 'A' });
    const i = await Item3.create({ title: 'i', author_id: o.id as number });
    await o.destroy();
    const reloaded = await Item3.find(i.id);
    expect(reloaded.readAttribute('author_id')).toBeNull();
  });
});

describe('Associations — polymorphic belongs_to / has_many { as }', () => {
  class Article2 extends Post {}
  class Forum extends Topic {}
  class Note extends Comment {}

  Article2.polymorphicAs('Article2');
  Forum.polymorphicAs('Forum');
  Note.belongsTo('commentable', { polymorphic: true });
  Article2.hasMany('notes', { class: () => Note, as: 'commentable' });
  Forum.hasMany('notes', { class: () => Note, as: 'commentable' });

  beforeEach(async () => {
    await fx.reset();
    Article2.useConnection(fx.adapter);
    Forum.useConnection(fx.adapter);
    Note.useConnection(fx.adapter);
    await Article2.loadSchema();
    await Forum.loadSchema();
    await Note.loadSchema();
  });

  test('polymorphic belongs_to resolves to the registered class', async () => {
    const a = await Article2.create({ title: 'a' });
    const c = await Note.create({ body: 'on article', commentable_id: a.id as number, commentable_type: 'Article2' });
    const target = await (c as unknown as { commentable: Promise<Base | null> }).commentable;
    expect(target?.readAttribute('title')).toBe('a');
  });

  test('polymorphic belongs_to returns null when type column is null', async () => {
    const c = await Note.create({ body: 'orphan' });
    expect(await (c as unknown as { commentable: Promise<Base | null> }).commentable).toBeNull();
  });

  test('has_many { as: } filters by FK + type column', async () => {
    const a = await Article2.create({ title: 'a' });
    const f = await Forum.create({ title: 'f' });
    await Note.create({ body: 'on article', commentable_id: a.id as number, commentable_type: 'Article2' });
    await Note.create({ body: 'also on article', commentable_id: a.id as number, commentable_type: 'Article2' });
    await Note.create({ body: 'on forum', commentable_id: f.id as number, commentable_type: 'Forum' });
    const aNotes = await (a as unknown as { notes: Promise<Note[]> }).notes;
    const fNotes = await (f as unknown as { notes: Promise<Note[]> }).notes;
    expect(aNotes.length).toBe(2);
    expect(fNotes.length).toBe(1);
  });
});

describe('Associations — includes / preload (eager loading)', () => {
  class Writer2 extends Author {}
  class Article3 extends Post {}
  Article3.belongsTo('author', { class: () => Writer2, foreignKey: 'author_id' });
  Writer2.hasMany('articles', { class: () => Article3, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Writer2.useConnection(fx.adapter);
    Article3.useConnection(fx.adapter);
    await Writer2.loadSchema();
    await Article3.loadSchema();
  });

  test('includes("author") populates each article cache in one query', async () => {
    const w = await Writer2.create({ name: 'A' });
    await Article3.create({ title: 'p1', author_id: w.id as number });
    await Article3.create({ title: 'p2', author_id: w.id as number });

    let executes = 0;
    const original = fx.adapter.execute.bind(fx.adapter);
    fx.adapter.execute = async (sql, binds) => {
      executes++;
      return original(sql, binds);
    };
    try {
      const articles = await Article3.includes('author');
      // One SELECT for the articles, plus one batched SELECT for authors → 2.
      expect(executes).toBe(2);
      // Each article's `.author` should hit the cache (no further queries).
      const before = executes;
      for (const a of articles) {
        const author = await (a as unknown as { author: Promise<Writer2 | null> }).author;
        expect(author?.readAttribute('name')).toBe('A');
      }
      expect(executes).toBe(before);
    } finally {
      fx.adapter.execute = original;
    }
  });

  test('includes("articles") populates each writer cache for has_many', async () => {
    const w = await Writer2.create({ name: 'B' });
    await Article3.create({ title: 'a', author_id: w.id as number });
    await Article3.create({ title: 'b', author_id: w.id as number });

    const writers = await Writer2.includes('articles');
    let executes = 0;
    const original = fx.adapter.execute.bind(fx.adapter);
    fx.adapter.execute = async (sql, binds) => {
      executes++;
      return original(sql, binds);
    };
    try {
      for (const writer of writers) {
        const arts = await (writer as unknown as { articles: Promise<Article3[]> }).articles;
        expect(arts.length).toBe(2);
      }
      expect(executes).toBe(0);
    } finally {
      fx.adapter.execute = original;
    }
  });

  test('preload is an alias for includes', async () => {
    const w = await Writer2.create({ name: 'C' });
    await Article3.create({ title: 'x', author_id: w.id as number });
    const writers = await Writer2.all().preload('articles');
    const arts = await (writers[0] as unknown as { articles: Promise<Article3[]> }).articles;
    expect(arts.length).toBe(1);
  });

  test('nested includes — "articles.author" preloads two hops in two batched queries', async () => {
    const w = await Writer2.create({ name: 'D' });
    await Article3.create({ title: 'x', author_id: w.id as number });
    await Article3.create({ title: 'y', author_id: w.id as number });

    let executes = 0;
    const original = fx.adapter.execute.bind(fx.adapter);
    fx.adapter.execute = async (sql, binds) => {
      executes++;
      return original(sql, binds);
    };
    try {
      const writers = await Writer2.includes('articles.author');
      // 1 SELECT writers + 1 SELECT articles + 1 SELECT authors back-refs = 3 queries.
      expect(executes).toBe(3);
      // Cached on both hops.
      const before = executes;
      for (const writer of writers) {
        const arts = await (writer as unknown as { articles: Promise<Article3[]> }).articles;
        for (const a of arts) {
          const back = await (a as unknown as { author: Promise<Writer2 | null> }).author;
          expect(back?.id).toBe(writer.id);
        }
      }
      expect(executes).toBe(before);
    } finally {
      fx.adapter.execute = original;
    }
  });
});

describe('Associations — has_many :through', () => {
  class User2 extends Author {}
  class Squad extends Team {}
  class Member extends Membership {}
  User2.hasMany('memberships', { class: () => Member, foreignKey: 'user_id' });
  User2.hasMany('teams', { through: 'memberships', source: 'team' });
  Member.belongsTo('user', { class: () => User2, foreignKey: 'user_id' });
  Member.belongsTo('team', { class: () => Squad, foreignKey: 'team_id' });

  beforeEach(async () => {
    await fx.reset();
    User2.useConnection(fx.adapter);
    Squad.useConnection(fx.adapter);
    Member.useConnection(fx.adapter);
    await User2.loadSchema();
    await Squad.loadSchema();
    await Member.loadSchema();
  });

  test('user.teams returns teams via memberships', async () => {
    const u = await User2.create({ name: 'Alex' });
    const t1 = await Squad.create({ name: 'Eng' });
    const t2 = await Squad.create({ name: 'Design' });
    await Member.create({ user_id: u.id as number, team_id: t1.id as number });
    await Member.create({ user_id: u.id as number, team_id: t2.id as number });
    const teams = await (u as unknown as { teams: Promise<Squad[]> }).teams;
    expect(teams.map((t) => t.readAttribute('name')).sort()).toEqual(['Design', 'Eng']);
  });
});

describe('Associations — LEFT OUTER JOIN / eagerLoad', () => {
  class Writer4 extends Author {}
  class Article5 extends Post {}
  Writer4.hasMany('articles', { class: () => Article5, foreignKey: 'author_id' });
  Article5.belongsTo('author', { class: () => Writer4, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Writer4.useConnection(fx.adapter);
    Article5.useConnection(fx.adapter);
    await Writer4.loadSchema();
    await Article5.loadSchema();
  });

  test('leftOuterJoins keeps rows without a match', async () => {
    await Writer4.create({ name: 'NoArticles' });
    const w = await Writer4.create({ name: 'HasOne' });
    await Article5.create({ title: 'one', author_id: w.id as number });
    const [_, sql] = Writer4.leftOuterJoins('articles').toSql();
    void _;
    expect(sql).toBeDefined();
    // Bare LEFT OUTER JOIN matches the writer without articles as well.
    const rows = await Writer4.leftOuterJoins('articles');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('eagerLoad both joins and preloads', async () => {
    const w = await Writer4.create({ name: 'A' });
    await Article5.create({ title: 'x', author_id: w.id as number });
    const writers = await Writer4.eagerLoad('articles');
    // Accessing .articles is cache-hit.
    let executes = 0;
    const original = fx.adapter.execute.bind(fx.adapter);
    fx.adapter.execute = async (sql, binds) => {
      executes++;
      return original(sql, binds);
    };
    try {
      for (const writer of writers) {
        const arts = await (writer as unknown as { articles: Promise<Article5[]> }).articles;
        void arts;
      }
      expect(executes).toBe(0);
    } finally {
      fx.adapter.execute = original;
    }
  });
});

describe('Associations — joins via association name', () => {
  class Writer3 extends Author {}
  class Article4 extends Post {}
  Article4.belongsTo('author', { class: () => Writer3, foreignKey: 'author_id' });

  beforeEach(async () => {
    await fx.reset();
    Writer3.useConnection(fx.adapter);
    Article4.useConnection(fx.adapter);
    await Writer3.loadSchema();
    await Article4.loadSchema();
  });

  test('joins("author") emits INNER JOIN and lets you filter on joined columns', async () => {
    const alice = await Writer3.create({ name: 'Alice' });
    const bob = await Writer3.create({ name: 'Bob' });
    await Article4.create({ title: 'a', author_id: alice.id as number });
    await Article4.create({ title: 'b', author_id: bob.id as number });
    const aliceArticles = await Article4.joins('author').where(['"authors"."name" = ?', 'Alice']);
    expect(aliceArticles.length).toBe(1);
    expect(aliceArticles[0]?.readAttribute('title')).toBe('a');
  });
});
