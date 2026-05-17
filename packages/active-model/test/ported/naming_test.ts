/**
 * Ported from activemodel/test/cases/naming_test.rb (Rails 7.2 branch).
 *
 * The Rails `ActiveModel::Name` class exposes singular/plural/element/
 * collection/route_key/param_key/i18n_key — most rely on the broader
 * inflector and namespacing rules we don't ship. We only have a small
 * `inflector` module (pluralize/underscore/camelize/tableize). Tests for
 * the Name class are skipped; inflector-level tests are kept.
 */

import { describe, expect, test } from 'bun:test';
import { camelize, pluralize, tableize, underscore } from '../../src';

describe('Naming — inflector', () => {
  test('pluralize basic', () => {
    expect(pluralize('post')).toBe('posts');
    expect(pluralize('user')).toBe('users');
  });
  test('pluralize -y to -ies', () => {
    expect(pluralize('city')).toBe('cities');
  });
  test('pluralize irregular', () => {
    expect(pluralize('person')).toBe('people');
    expect(pluralize('child')).toBe('children');
  });
  test('pluralize uncountable', () => {
    expect(pluralize('fish')).toBe('fish');
    expect(pluralize('sheep')).toBe('sheep');
  });
  test('underscore: CamelCase -> snake_case', () => {
    expect(underscore('UserAccount')).toBe('user_account');
    expect(underscore('OrderItem')).toBe('order_item');
  });
  test('camelize: snake_case -> CamelCase', () => {
    expect(camelize('user_account')).toBe('UserAccount');
  });
  test('camelize lower: snake_case -> camelCase', () => {
    expect(camelize('user_account', true)).toBe('userAccount');
  });
  test('tableize: ClassName -> table_names', () => {
    expect(tableize('UserAccount')).toBe('user_accounts');
    expect(tableize('Person')).toBe('people');
  });

  test('Name#singular', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').singular).toBe('post_track_back');
  });
  test('Name#plural', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').plural).toBe('post_track_backs');
  });
  test('Name#element', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').element).toBe('track_back');
  });
  test('Name#collection', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').collection).toBe('post/track_backs');
  });
  test('Name#human', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').human).toBe('Track back');
  });
  test('Name#route_key', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').route_key).toBe('post_track_backs');
  });
  test('Name#param_key', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').param_key).toBe('post_track_back');
  });
  test('Name#i18n_key', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').i18n_key).toBe('post/track_back');
  });
  test('Name#uncountable', async () => {
    const { Name } = await import('../../src');
    expect(new Name('Post::TrackBack').uncountable).toBe(false);
    expect(new Name('Sheep').uncountable).toBe(true);
  });

  test('namespaced model: Blog::Post', async () => {
    const { Name } = await import('../../src');
    const n = new Name('Blog::Post');
    expect(n.singular).toBe('blog_post');
    expect(n.plural).toBe('blog_posts');
    expect(n.element).toBe('post');
    expect(n.collection).toBe('blog/posts');
    expect(n.human).toBe('Post');
  });
});
