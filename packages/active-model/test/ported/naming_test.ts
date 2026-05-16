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

  test.skip('Name#singular (TODO: Name class)', () => {});
  test.skip('Name#plural (TODO: Name class)', () => {});
  test.skip('Name#element (TODO: Name class)', () => {});
  test.skip('Name#collection (TODO: Name class)', () => {});
  test.skip('Name#human (TODO: Name#human)', () => {});
  test.skip('Name#route_key (TODO: routing helpers)', () => {});
  test.skip('Name#param_key (TODO: routing helpers)', () => {});
  test.skip('Name#i18n_key (TODO: i18n)', () => {});
  test.skip('Name#uncountable? (TODO)', () => {});

  test.skip('namespaced model: Blog::Post (TODO: namespacing)', () => {});
});
