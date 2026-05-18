/**
 * Ported from activemodel/test/cases/errors_test.rb (Rails 7.2 branch).
 *
 * Tests covering features we haven't implemented yet — symbol error types
 * with default messages (`:blank` -> "can't be blank"), i18n, `added?`,
 * `where`, `import`/`copy!`/`merge!`, `details`, Proc messages, marshalling,
 * YAML compat — are marked `test.skip` with a TODO. Enable them as we
 * expand the Errors surface.
 */

import { describe, expect, test } from 'bun:test';
import { Errors } from '../../src';

// Lightweight stand-in for the Rails `Person` test class — wraps an `Errors`
// instance and exposes a Rails-flavored `validate!`.
class Person {
  errors = new Errors();
  name: string | null = null;
  validate(): void {
    if (this.name == null) this.errors.add('name', 'cannot be nil');
  }
}

describe('Errors', () => {
  test('delete', () => {
    const errors = new Errors();
    errors.add('name', "can't be blank");
    errors.delete('name');
    expect(errors.on('name')).toEqual([]);
  });

  test('include? — `errors.includes(attr)`', () => {
    const errors = new Errors();
    errors.add('foo', 'omg');
    expect(errors.includes('foo')).toBe(true);
  });

  test('each (iteration is in insertion order)', () => {
    const errors = new Errors();
    errors.add('name', "can't be blank");
    errors.add('gender', "can't be blank");
    expect([...errors].map((e) => e.attribute)).toEqual(['name', 'gender']);
  });

  test('any?', () => {
    const errors = new Errors();
    errors.add('name', 'is invalid');
    expect(errors.any).toBe(true);
  });

  test('first — returns an ErrorObject', async () => {
    const { ErrorObject } = await import('../../src');
    const errors = new Errors();
    errors.add('name', 'blank');
    expect(errors.first).toBeInstanceOf(ErrorObject);
    expect(errors.first?.attribute).toBe('name');
  });

  test('objects — exposes rich ErrorObject entries', async () => {
    const { ErrorObject } = await import('../../src');
    const errors = new Errors();
    errors.add('name', 'is invalid');
    errors.add('email', 'is invalid');
    for (const e of errors.objects) expect(e).toBeInstanceOf(ErrorObject);
    expect(errors.objects[0]?.fullMessage()).toBe('Name is invalid');
  });

  test('dup — duplicates errors independently', () => {
    const errors = new Errors();
    errors.add('name', 'is invalid');
    const dup = errors.dup();
    dup.add('email', 'is invalid');
    expect(errors.attributeNames).toEqual(['name']);
    expect(dup.attributeNames).toEqual(['name', 'email']);
  });

  test('has_key? — `errors.includes(attr)`', () => {
    const errors = new Errors();
    errors.add('foo', 'omg');
    expect(errors.includes('foo')).toBe(true);
    expect(errors.includes('name')).toBe(false);
  });

  test('where filters by attribute', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    errors.add('name', 'too_short', { count: 5 });
    errors.add('age', 'blank');
    expect(errors.where('name').length).toBe(2);
    expect(errors.where('age').length).toBe(1);
  });

  test('where filters by attribute and type', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    errors.add('name', 'too_short', { count: 5 });
    errors.add('name', 'invalid');
    const result = errors.where('name', 'too_short');
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe('too_short');
  });

  test('where filters by attribute, type, and options', () => {
    const errors = new Errors();
    errors.add('name', 'too_short', { count: 2 });
    errors.add('name', 'too_short', { count: 5 });
    const result = errors.where('name', 'too_short', { count: 2 });
    expect(result.length).toBe(1);
    expect(result[0]?.options?.count).toBe(2);
  });

  test('where returns empty when no match', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    expect(errors.where('age')).toEqual([]);
    expect(errors.where('name', 'too_short')).toEqual([]);
  });

  test('where returns Error entries', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    errors.add('name', 'too_short', { count: 5 });
    const result = errors.where('name');
    expect(result.length).toBe(2);
    for (const e of result) expect(typeof e.attribute).toBe('string');
  });

  test('clear errors', () => {
    const person = new Person();
    person.validate();
    expect(person.errors.count).toBe(1);
    person.errors.clear();
    expect(person.errors.empty).toBe(true);
  });

  test('byAttribute("name") is the indexed-access equivalent', () => {
    const errors = new Errors();
    errors.add('name', 'omg');
    expect(errors.byAttribute('name')).toEqual(['omg']);
  });

  test('attribute_names returns the error attributes', () => {
    const errors = new Errors();
    errors.add('foo', 'omg');
    errors.add('baz', 'zomg');
    expect(errors.attributeNames).toEqual(['foo', 'baz']);
  });

  test('attribute_names only returns unique attribute names', () => {
    const errors = new Errors();
    errors.add('foo', 'omg');
    errors.add('foo', 'zomg');
    expect(errors.attributeNames).toEqual(['foo']);
  });

  test('attribute_names returns an empty array after accessing messages only', () => {
    const errors = new Errors();
    void errors.messages['foo'];
    void errors.messages['baz'];
    expect(errors.attributeNames).toEqual([]);
  });

  test('detecting whether there are errors with empty/blank/include', () => {
    const person = new Person();
    expect(person.errors.empty).toBe(true);
    expect(person.errors.includes('foo')).toBe(false);
    person.errors.add('foo', 'New error');
    expect(person.errors.empty).toBe(false);
    expect(person.errors.includes('foo')).toBe(true);
  });

  test('include? does not add a key to messages', () => {
    const person = new Person();
    person.errors.includes('foo');
    expect(Object.keys(person.errors.messages)).not.toContain('foo');
  });

  test('adding errors using conditionals with Person#validate', () => {
    const person = new Person();
    person.validate();
    expect(person.errors.fullMessages).toEqual(['Name cannot be nil']);
    expect(person.errors.on('name')).toEqual(['cannot be nil']);
  });

  test('add creates an error entry and returns it', () => {
    const person = new Person();
    const error = person.errors.add('name', 'blank');
    expect(error.attribute).toBe('name');
    expect(error.type).toBe('blank');
  });

  test('add with symbol-style type uses the default message', () => {
    const person = new Person();
    person.errors.add('name', 'blank');
    expect(person.errors.on('name')).toEqual(["can't be blank"]);
  });

  test('add with string type', () => {
    const person = new Person();
    person.errors.add('name', 'custom msg');
    expect(person.errors.on('name')).toEqual(['custom msg']);
  });

  test('add with nil-ish type defaults to "is invalid"', () => {
    const person = new Person();
    person.errors.add('name');
    expect([...person.errors][0]?.type).toBe('invalid');
    expect(person.errors.on('name')).toEqual(['is invalid']);
  });

  test('add with function/Proc type returns a custom message', () => {
    const errors = new Errors();
    errors.add('name', 'invalid', { message: 'custom msg' });
    expect(errors.on('name')).toEqual(['custom msg']);
  });

  test('add with symbol + custom message override', () => {
    const person = new Person();
    person.errors.add('name', 'blank', { message: 'cannot be blank' });
    expect(person.errors.on('name')).toEqual(['cannot be blank']);
  });
  test('Proc-like resolution via the message override at add() time', () => {
    const errors = new Errors();
    errors.add('name', 'invalid', { message: 'NO BLANKS HERE' });
    expect(errors.on('name')).toEqual(['NO BLANKS HERE']);
  });

  test('added? returns true for matching attribute/type/options', () => {
    const person = new Person();
    person.errors.add('family_members.name', 'too_long', { count: 25 });
    expect(person.errors.added('family_members.name', 'too_long', { count: 25 })).toBe(true);
    expect(person.errors.added('family_members.name', 'too_long', { count: 26 })).toBe(false);
  });

  test('added? ignores extra options when only attribute/type are passed', () => {
    const errors = new Errors();
    errors.add('name', 'too_long', { count: 25 });
    expect(errors.added('name', 'too_long')).toBe(true);
  });

  test('added? matches by attribute + type, even without explicit options', () => {
    const errors = new Errors();
    errors.add('name', 'too_long', { count: 25 });
    expect(errors.added('name', 'too_long')).toBe(true);
    expect(errors.added('name', 'too_long', { count: 24 })).toBe(false);
  });

  test('added? handles symbol-style type', () => {
    const person = new Person();
    person.errors.add('name', 'blank');
    expect(person.errors.added('name', 'blank')).toBe(true);
  });

  test('added? returns false when no errors are present', () => {
    expect(new Person().errors.added('name')).toBe(false);
  });

  test('added? matches multiple messages for same attribute', () => {
    const person = new Person();
    person.errors.add('name', "can't be blank");
    person.errors.add('name', 'is invalid');
    expect(person.errors.added('name')).toBe(true);
  });

  test('of_kind? returns true when attribute + type/message both match', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    expect(errors.ofKind('name', 'blank')).toBe(true);
    expect(errors.ofKind('name', 'too_short')).toBe(false);
    expect(errors.ofKind('age')).toBe(false);
    expect(errors.ofKind('name')).toBe(true);
  });

  test('size calculates the number of error messages', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.size).toBe(1);
  });

  test('count calculates the number of error messages', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.count).toBe(1);
  });

  test('to_a — `errors.fullMessages` returns the list with attribute names', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    person.errors.add('name', 'cannot be nil');
    expect(person.errors.fullMessages).toEqual(['Name cannot be blank', 'Name cannot be nil']);
  });

  test('to_hash — `errors.messages` returns the error-messages hash', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.messages).toEqual({ name: ['cannot be blank'] });
  });

  test('asJson returns messages by attribute', () => {
    const errors = new Errors();
    errors.add('name', 'cannot be nil');
    expect(errors.asJson()).toEqual({ name: ['cannot be nil'] });
  });

  test('asJson({ fullMessages: true }) returns humanized strings', () => {
    const errors = new Errors();
    errors.add('name', 'cannot be nil');
    expect(errors.asJson({ fullMessages: true })).toEqual({ name: ['Name cannot be nil'] });
  });

  test('messages returns empty when accessed with non-existent attribute', () => {
    const errors = new Errors();
    expect(errors.messages['foo']).toBeUndefined();
    expect(errors.on('foo')).toEqual([]);
  });

  test('messages_for / full_messages_for filter by type', () => {
    const person = new Person();
    person.errors.add('name', 'invalid');
    person.errors.add('name', 'too_long', { message: 'is too long', count: 10 });
    expect(person.errors.messagesFor('name', 'too_long')).toEqual(['is too long']);
    expect(person.errors.fullMessagesFor('name', 'too_long')).toEqual(['Name is too long']);
  });

  test('messages_for — `errors.on(attr)` contains all messages', () => {
    const person = new Person();
    person.errors.add('name', 'is invalid');
    expect(person.errors.on('name')).toEqual(['is invalid']);
  });

  test('full_messages_for — `errors.fullMessagesFor(attr)`', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    person.errors.add('name', 'cannot be nil');
    expect(person.errors.fullMessagesFor('name')).toEqual(['Name cannot be blank', 'Name cannot be nil']);
  });

  test('full_messages_for does not contain messages from other attributes', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    person.errors.add('email', 'cannot be blank');
    expect(person.errors.fullMessagesFor('name')).toEqual(['Name cannot be blank']);
  });

  test('full_messages_for returns empty list for an attribute without errors', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.fullMessagesFor('email')).toEqual([]);
  });

  test('full_message — standalone formatter', () => {
    const person = new Person();
    expect(person.errors.fullMessage('base', 'press the button')).toBe('press the button');
    expect(person.errors.fullMessage('name', 'cannot be blank')).toBe('Name cannot be blank');
  });

  test('full_messages prefixes the humanized attribute', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.fullMessages).toContain('Name cannot be blank');
  });

  test('details returns the structured error payload', () => {
    const errors = new Errors();
    errors.add('name', 'invalid');
    errors.add('name', 'too_short', { count: 5 });
    errors.add('age', 'greater_than', { count: 18 });
    expect(errors.details).toEqual({
      name: [{ error: 'invalid' }, { error: 'too_short', count: 5 }],
      age: [{ error: 'greater_than', count: 18 }],
    });
  });

  test('groupByAttribute returns ErrorObjects per attribute', async () => {
    const { ErrorObject } = await import('../../src');
    const errors = new Errors();
    errors.add('name', 'invalid');
    errors.add('name', 'too_short');
    errors.add('age', 'present');
    const grouped = errors.groupByAttribute();
    expect(grouped['name']?.length).toBe(2);
    expect(grouped['age']?.length).toBe(1);
    expect(grouped['name']?.[0]).toBeInstanceOf(ErrorObject);
  });

  test('get(attr) is an alias for on(attr)', () => {
    const errors = new Errors();
    errors.add('name', 'is bad');
    expect(errors.get('name')).toEqual(errors.on('name'));
  });
  test('delete returns the deleted messages', () => {
    const errors = new Errors();
    errors.add('name', 'invalid');
    expect(errors.delete('name')).toEqual(['is invalid']);
  });

  test('delete with type removes only matching entries', () => {
    const errors = new Errors();
    errors.add('name', 'blank');
    errors.add('name', 'invalid');
    errors.delete('name', 'blank');
    expect(errors.added('name', 'blank')).toBe(false);
    expect(errors.added('name', 'invalid')).toBe(true);
  });

  test('delete with type and options matches only exact', () => {
    const errors = new Errors();
    errors.add('name', 'too_short', { count: 5 });
    errors.add('name', 'too_short', { count: 10 });
    errors.delete('name', 'too_short', { count: 5 });
    expect(errors.where('name', 'too_short').length).toBe(1);
    expect(errors.added('name', 'too_short', { count: 10 })).toBe(true);
  });
  test('clear removes details', () => {
    const errors = new Errors();
    errors.add('name', 'invalid');
    expect(errors.details).toEqual({ name: [{ error: 'invalid' }] });
    errors.clear();
    expect(errors.details).toEqual({});
  });
  test('merge appends another Errors collection', () => {
    const other = new Errors();
    other.add('name', 'invalid');
    const person = new Person();
    person.errors.add('name', 'blank');
    person.errors.merge(other);
    expect(person.errors.on('name')).toEqual(["can't be blank", 'is invalid']);
  });

  test('copy replaces this collection with another', () => {
    const other = new Errors();
    other.add('email', 'invalid');
    const person = new Person();
    person.errors.add('name', 'blank');
    person.errors.copy(other);
    expect(person.errors.attributeNames).toEqual(['email']);
  });

  test('import absorbs a foreign error entry', () => {
    const source = new Errors();
    source.add('name', 'invalid');
    const target = new Errors();
    const imported = target.import(source.objects[0]!);
    expect(target.attributeNames).toEqual(['name']);
    // 'invalid' is a known symbol type → message becomes "is invalid"
    expect(imported.message).toBe('is invalid');
  });

  test('import with attribute override', () => {
    const source = new Errors();
    source.add('name', 'invalid');
    const target = new Errors();
    target.import(source.objects[0]!, { attribute: 'age' });
    expect(target.attributeNames).toEqual(['age']);
  });
  test('toHash(true) returns full-message variant', () => {
    const errors = new Errors();
    errors.add('name', 'cannot be blank');
    expect(errors.toHash(true)).toEqual({ name: ['Name cannot be blank'] });
  });
  test('uniq removes duplicates', () => {
    const errors = new Errors();
    errors.add('name', 'invalid');
    errors.add('name', 'invalid');
    expect(errors.size).toBe(2);
    errors.uniq();
    expect(errors.size).toBe(1);
  });

  test('inspect returns a debug-friendly string', () => {
    const errors = new Errors();
    errors.add('base', 'something happened');
    expect(errors.inspect()).toMatch(/Errors:.*attribute=base/);
  });
});
