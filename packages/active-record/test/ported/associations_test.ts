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
import { Base } from '../../src';
import { type Fixtures, setupFixtures, Author, Post, Comment, Topic } from './_fixtures';

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
    const entries = (b as unknown as { entries: { order: (...args: unknown[]) => { limit: (n: number) => Promise<Entry[]> } } }).entries;
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
    Item1.beforeDestroy(() => { destroyed++; });
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
    Item2.beforeDestroy(() => { fired++; });
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
