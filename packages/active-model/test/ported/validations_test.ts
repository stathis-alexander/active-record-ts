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


  test('errors on custom attribute', () => {
    const t = new Topic();
    t.errors.add('fooBar', 'is invalid');
    expect(t.errors.fullMessages).toEqual(['Foo bar is invalid']);
  });


  test('errors empty after errors-on check', () => {
    const t = new Topic();
    expect(t.errors.on('id')).toEqual([]);
    expect(t.errors.empty).toBe(true);
  });

  test('validates_each iterates each named attribute', async () => {
    let hits = 0;
    Topic.validatesEach(['title', 'content'], (_record, attr, _value, errors) => {
      errors.add(attr, 'gotcha');
      hits++;
    });
    const t = new Topic({ title: 'valid', content: 'whatever' });
    expect(await t.isInvalid()).toBe(true);
    expect(hits).toBe(2);
    expect(t.errors.on('title')).toEqual(['gotcha']);
    expect(t.errors.on('content')).toEqual(['gotcha']);
  });

  test.skip('validates_each custom reader (TODO: read_attribute_for_validation)', () => {});
  test('validate { } block — inline block validator', async () => {
    Topic.validate((t, errors) => {
      errors.add('title', 'will never be valid');
    });
    const t = new Topic({ title: 'Title', content: 'whatever' });
    expect(await t.isInvalid()).toBe(true);
    expect(t.errors.on('title')).toContain('will never be valid');
  });

  test('validate { |record| } — block receives the record', async () => {
    let received = false;
    Topic.validate((record) => {
      if (record instanceof Topic) received = true;
    });
    await new Topic().validate();
    expect(received).toBe(true);
  });

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

  test('validation context: validates only fires when context matches', async () => {
    Topic.validatesPresenceOf('title', { on: 'create' });
    const t = new Topic();
    // No context → validators with `on` are skipped.
    expect(await t.isValid()).toBe(true);
    // `on: 'create'` matches.
    expect(await t.isValid('create')).toBe(false);
    expect(t.errors.on('title').length > 0).toBe(true);
    // Different context → skipped.
    expect(await t.isValid('update')).toBe(true);
  });

  test('invalid is the opposite of valid', async () => {
    Topic.validatesPresenceOf('title');
    const t = new Topic();
    expect(await t.isInvalid()).toBe(true);
    expect(t.errors.on('title').length > 0).toBe(true);
    t.title = 'Things are going to change';
    expect(await t.isInvalid()).toBe(false);
  });

  test('validation with message as Proc evaluates at error-add time', async () => {
    Topic.validatesPresenceOf('title', { message: () => 'NO BLANKS HERE' });
    const t = new Topic();
    expect(await t.isValid()).toBe(false);
    expect(t.errors.on('title')).toEqual(['NO BLANKS HERE']);
  });

  test('validation message Proc receives the record', async () => {
    Topic.validatesPresenceOf('title', {
      message: (record) => `You have failed me for the last time, ${(record as Topic).authorName ?? 'Admiral'}.`,
    });
    const t = new Topic({ authorName: 'Admiral' });
    await t.validate();
    expect(t.errors.on('title')).toEqual(['You have failed me for the last time, Admiral.']);
  });

  test('validation message Proc receives record + data { attribute, value, type }', async () => {
    Topic.validatesPresenceOf('title', {
      message: (record, data) =>
        `${data.attribute} is missing. You have failed me for the last time, ${(record as Topic).authorName ?? 'Admiral'}.`,
    });
    const t = new Topic({ authorName: 'Admiral' });
    await t.validate();
    expect(t.errors.on('title')).toEqual([
      'title is missing. You have failed me for the last time, Admiral.',
    ]);
  });

  test('list of validators for model', () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesLengthOf('title', { minimum: 2 });
    const validators = Topic.validators();
    expect(validators.length).toBe(2);
    expect(validators.map((v) => (v as unknown as { kind: string }).kind)).toEqual(['presence', 'length']);
  });

  test('list of validators on an attribute', () => {
    Topic.validatesPresenceOf('title');
    Topic.validatesPresenceOf('content');
    Topic.validatesLengthOf('title', { minimum: 2 });
    const titleValidators = Topic.validatorsOn('title');
    expect(titleValidators.length).toBe(2);
    expect(titleValidators.map((v) => (v as unknown as { kind: string }).kind)).toEqual(['presence', 'length']);
    const contentValidators = Topic.validatorsOn('content');
    expect(contentValidators.length).toBe(1);
  });

  test('validators_on for multiple attributes', () => {
    Topic.validates('title', { length: { minimum: 10 } });
    Topic.validates('authorName', { presence: true, format: { with: /a/ } });
    const validators = Topic.validatorsOn('title', 'authorName');
    expect(validators.length).toBe(3);
  });

  test('validators_on is empty when no validator matches', () => {
    Topic.validates('title', { length: { minimum: 10 } });
    expect(Topic.validatorsOn('authorName')).toEqual([]);
  });

  test.skip('accessing instance of validator — `validators_on(:title).first.options` (TODO: option exposure)', () => {});

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

  test('validate! raises ValidationError', async () => {
    Topic.validatesPresenceOf('title');
    await expect(new Topic().validateOrThrow()).rejects.toThrow();
  });

  test('validate! with context', async () => {
    Topic.validatesPresenceOf('title', { on: 'publish' });
    const t = new Topic();
    await expect(t.validateOrThrow('publish')).rejects.toThrow();
    expect(await new Topic({ title: 'ok' }).validateOrThrow('publish')).toBe(true);
  });

  test('validation context: array of contexts', async () => {
    Topic.validatesPresenceOf('title', { on: ['create', 'publish'] });
    const t = new Topic();
    expect(await t.isValid('create')).toBe(false);
    expect(await t.isValid('publish')).toBe(false);
    expect(await t.isValid('update')).toBe(true);
  });

  test('strict validation throws on failure', async () => {
    const { StrictValidationFailed } = await import('../../src');
    Topic.validatesPresenceOf('title', { strict: true });
    await expect(new Topic().validate()).rejects.toBeInstanceOf(StrictValidationFailed);
  });

  test('strict validation does not fail when valid', async () => {
    Topic.validatesPresenceOf('title', { strict: true });
    expect(await new Topic({ title: 'ok' }).validate()).toBe(true);
  });

  test('strict per-validator option', async () => {
    const { StrictValidationFailed } = await import('../../src');
    Topic.validates('title', { presence: { strict: true } });
    await expect(new Topic().validate()).rejects.toBeInstanceOf(StrictValidationFailed);
  });

  test('strict custom exception class', async () => {
    class CustomStrictValidationException extends Error {}
    Topic.validatesPresenceOf('title', { strict: CustomStrictValidationException });
    await expect(new Topic().validate()).rejects.toBeInstanceOf(CustomStrictValidationException);
  });

  test('strict error message includes humanized attribute', async () => {
    const { StrictValidationFailed } = await import('../../src');
    Topic.validatesPresenceOf('title', { strict: true });
    try {
      await new Topic().validate();
    } catch (err) {
      expect(err).toBeInstanceOf(StrictValidationFailed);
      expect((err as Error).message).toBe("Title can't be blank");
      return;
    }
    throw new Error('expected throw');
  });

  test.skip('validates! class-level strict toggle (TODO: Topic.validates_bang)', () => {});

  test('validates with false hash value', async () => {
    Topic.validates('title', { presence: false });
    expect(await new Topic().isValid()).toBe(true);
  });


  test('does not modify options argument', async () => {
    const options = { presence: true } as const;
    Topic.validates('title', options);
    expect(options).toEqual({ presence: true });
  });

  test.skip('dup validity is independent (TODO: dup)', () => {});

  test.skip('frozen models can be validated (TODO: frozen support)', () => {});

  test('exceptOn skips the validator for matching contexts', async () => {
    Topic.validatesPresenceOf('title', { exceptOn: 'custom_context' });
    const t = new Topic();
    expect(await t.isValid('create')).toBe(false);
    expect(await t.isValid('custom_context')).toBe(true);
  });

  test.skip('validations some with except (TODO: per-rule exceptOn)', () => {});
});
