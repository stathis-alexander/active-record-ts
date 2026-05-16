/**
 * Ported from activemodel/test/cases/validations_test.rb (Rails 7.2 branch).
 *
 * Focused subset — the AM Validations test relies heavily on Rails-specific
 * features we haven't implemented: validation contexts (`on: :update`),
 * strict mode, `validate { ... }` blocks, `validators_on`, Proc messages,
 * `validate!`, and the Topic/Reply fixture's i18n-style "is Empty" output.
 * Tests for those are skipped with TODOs.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { Model } from '../../src';

class Topic extends Model {
  declare title: string;
  declare content: string;
  declare authorName: string;
}
Topic.attribute('title', 'string');
Topic.attribute('content', 'string');
Topic.attribute('authorName', 'string');

const reset = () => {
  // Reset the per-class validator list. We don't have `clear_validators!`
  // as a public API, so reach into the registry symbol used by Model.
  // biome-ignore lint/suspicious/noExplicitAny: registry inspection for test teardown
  const reg = (Topic as any)[Symbol.for('@arelts/active-model:registry')];
  if (reg) reg.validators.length = 0;
};

afterEach(reset);

describe('Validations', () => {
  test('single attr validation and error msg', async () => {
    Topic.validatesPresenceOf('title');
    const t = new Topic({ content: 'something' });
    expect(await t.isValid()).toBe(false);
    expect(t.errors.on('title')).toEqual(["can't be blank"]);
    expect(t.errors.count).toBe(1);
  });

  test('multiple attrs validation and error msg', async () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesPresenceOf('content');
    const t = new Topic();
    expect(await t.isValid()).toBe(false);
    expect(t.errors.on('title')).toEqual(["can't be blank"]);
    expect(t.errors.on('content')).toEqual(["can't be blank"]);
    expect(t.errors.count).toBe(2);
  });

  test.skip('errors on nested attributes expands name (TODO: dotted attribute names)', () => {});

  test('errors on base', async () => {
    Topic.validatesPresenceOf('title');
    const t = new Topic({ content: 'Mismatch' });
    await t.validate();
    t.errors.add('base', 'Reply is not dignifying');
    expect(t.errors.on('base')).toEqual(['Reply is not dignifying']);
    expect(t.errors.fullMessages).toContain('Reply is not dignifying');
    expect(t.errors.count).toBe(2);
  });

  test.skip('errors on base with symbol message (TODO: symbol-as-type)', () => {});

  test('errors on custom attribute', () => {
    const t = new Topic();
    t.errors.add('fooBar', 'is invalid');
    expect(t.errors.fullMessages).toEqual(['Foo bar is invalid']);
  });

  test.skip('errors on custom attribute with symbol message (TODO: symbol)', () => {});

  test('errors empty after errors-on check', () => {
    const t = new Topic();
    expect(t.errors.on('id')).toEqual([]);
    expect(t.errors.empty).toBe(true);
  });

  test.skip('validates_each iterates attributes (TODO: validates_each)', () => {});
  test.skip('validates_each custom reader (TODO: read_attribute_for_validation)', () => {});
  test.skip('validate { } block (TODO: block validators)', () => {});
  test.skip('validate { |record| } block (TODO: block validators)', () => {});
  test.skip('validates :if array immutability (TODO)', () => {});
  test.skip('invalid_validator raises NoMethodError (TODO: method-name validators)', () => {});
  test.skip('invalid_options_to_validate raises ArgumentError (TODO: arg checking)', () => {});
  test.skip('callback_options_to_validate ordering with :prepend (TODO)', () => {});

  test('errors_to_json — `errors.toJSON()` snapshot', async () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesPresenceOf('content');
    const t = new Topic();
    await t.validate();
    expect(t.errors.toJSON()).toEqual({ title: ["can't be blank"], content: ["can't be blank"] });
  });

  test('validation order — presence then length on same attribute', async () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesLengthOf('title', { minimum: 2 });
    const t = new Topic({ title: '' });
    expect(await t.isValid()).toBe(false);
    expect(t.errors.on('title')[0]).toBe("can't be blank");
  });

  test.skip('validation with :if and :on (TODO: contexts)', () => {});

  test('invalid is the opposite of valid', async () => {
    Topic.validatesPresenceOf('title');
    const t = new Topic();
    expect(await t.isInvalid()).toBe(true);
    expect(t.errors.on('title').length > 0).toBe(true);
    t.title = 'Things are going to change';
    expect(await t.isInvalid()).toBe(false);
  });

  test.skip('validation with message as Proc (TODO: Proc message)', () => {});
  test.skip('validation message Proc receives record (TODO)', () => {});
  test.skip('validation message Proc receives record + data (TODO)', () => {});

  test.skip('list of validators for model (TODO: validators introspection)', () => {});
  test.skip('list of validators on an attribute (TODO: validators_on)', () => {});
  test.skip('accessing instance of validator (TODO)', () => {});
  test.skip('list of validators on multiple attributes (TODO)', () => {});
  test.skip('list of validators empty when none (TODO)', () => {});

  test('validations on the instance level', async () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesPresenceOf('authorName');
    Topic.validatesLengthOf('content', { minimum: 10 });
    const t = new Topic();
    expect(await t.isInvalid()).toBe(true);
    expect(t.errors.size).toBe(3);
    t.title = 'Some Title';
    t.authorName = 'Some Author';
    t.content = 'Some Content Whose Length is more than 10.';
    expect(await t.isValid()).toBe(true);
  });

  test.skip('validate using a block (TODO: validate-do-end)', () => {});

  test.skip('validate! raises ValidationError (TODO: validate-bang)', () => {});
  test.skip('validate! with context (TODO: contexts)', () => {});
  test.skip('strict validation in validates (TODO: strict mode)', () => {});
  test.skip('strict validation does not fail when valid (TODO: strict mode)', () => {});
  test.skip('strict validation particular validator (TODO)', () => {});
  test.skip('strict validation custom validator helper (TODO)', () => {});
  test.skip('strict validation custom exception (TODO)', () => {});
  test.skip('validates! bang variant (TODO)', () => {});

  test('validates with false hash value', async () => {
    Topic.validates('title', { presence: false });
    expect(await new Topic().isValid()).toBe(true);
  });

  test.skip('strict validation error message (TODO)', () => {});

  test('does not modify options argument', async () => {
    const options = { presence: true } as const;
    Topic.validates('title', options);
    expect(options).toEqual({ presence: true });
  });

  test.skip('dup validity is independent (TODO: dup)', () => {});

  test.skip('frozen models can be validated (TODO: frozen support)', () => {});

  test.skip('except_on (TODO: contexts)', () => {});
  test.skip('validations some with except (TODO: contexts)', () => {});
});
