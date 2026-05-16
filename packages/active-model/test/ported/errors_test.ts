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

  test.skip('first — returns an Error object (TODO: Error wrapper class)', () => {});

  test.skip('dup — duplicates errors independently (TODO: dup)', () => {});

  test('has_key? — `errors.includes(attr)`', () => {
    const errors = new Errors();
    errors.add('foo', 'omg');
    expect(errors.includes('foo')).toBe(true);
    expect(errors.includes('name')).toBe(false);
  });

  test.skip('where filters by attribute (TODO: where method)', () => {});
  test.skip('where filters by attribute and type (TODO: where + type)', () => {});
  test.skip('where filters by attribute, type, and options (TODO: where + options)', () => {});
  test.skip('where returns empty when no match (TODO: where)', () => {});
  test.skip('where returns Error objects (TODO: Error wrapper)', () => {});

  test('clear errors', () => {
    const person = new Person();
    person.validate();
    expect(person.errors.count).toBe(1);
    person.errors.clear();
    expect(person.errors.empty).toBe(true);
  });

  test.skip('error access is indifferent — `errors["name"]` aliases `:name` (TODO: indexed access)', () => {});

  test.skip('attribute_names returns the error attributes (TODO: attributeNames API)', () => {});
  test.skip('attribute_names only returns unique attribute names (TODO)', () => {});
  test.skip('attribute_names returns an empty array after accessing messages (TODO)', () => {});

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

  test.skip('add creates an error object and returns it (TODO: Error wrapper)', () => {});
  test.skip('add with symbol type (TODO: symbol -> default message)', () => {});

  test('add with string type', () => {
    const person = new Person();
    person.errors.add('name', 'custom msg');
    expect(person.errors.on('name')).toEqual(['custom msg']);
  });

  test.skip('add with nil type (default "is invalid") (TODO: default invalid)', () => {});
  test.skip('add with Proc type (TODO: Proc messages)', () => {});
  test.skip('add with symbol + custom message (TODO: symbol)', () => {});
  test.skip('Proc message that evaluates to String (TODO)', () => {});

  test.skip('added? family — attribute through collection (TODO: added?)', () => {});
  test.skip('added? ignores callback option (TODO: added?)', () => {});
  test.skip('added? ignores message option (TODO: added?)', () => {});
  test.skip('added? indifferent access (TODO: added?)', () => {});
  test.skip('added? handles symbol message (TODO: added?)', () => {});
  test.skip('added? returns false when no errors (TODO: added?)', () => {});
  test.skip('added? matches multiple messages for same attr (TODO: added?)', () => {});

  test.skip('of_kind? family (TODO: of_kind?)', () => {});

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

  test.skip('as_json (TODO: dedicated as_json shape)', () => {});

  test('messages returns empty when accessed with non-existent attribute', () => {
    const errors = new Errors();
    expect(errors.messages['foo']).toBeUndefined();
    expect(errors.on('foo')).toEqual([]);
  });

  test.skip('messages_for / full_messages_for with type filter (TODO: type filter)', () => {});

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

  test.skip('full_message — standalone formatter (TODO: full_message)', () => {});

  test('full_messages prefixes the humanized attribute', () => {
    const person = new Person();
    person.errors.add('name', 'cannot be blank');
    expect(person.errors.fullMessages).toContain('Name cannot be blank');
  });

  test.skip('details / details_for / structured details payload (TODO: details)', () => {});
  test.skip('group_by_attribute (TODO)', () => {});
  test.skip('delete returns nil/messages (TODO: delete return value)', () => {});
  test.skip('delete with type / options (TODO: type-filtered delete)', () => {});
  test.skip('clear removes details (TODO: details API)', () => {});
  test.skip('copy! / merge! / import / NestedError (TODO)', () => {});
  test.skip('errors are marshalable (TODO: marshal not applicable)', () => {});
  test.skip('YAML compatibility with Rails 6.x (TODO: not applicable)', () => {});
  test.skip('to_hash with full_messages flag (TODO)', () => {});
  test.skip('uniq! removes duplicates (TODO)', () => {});
  test.skip('inspect format (TODO)', () => {});
});
