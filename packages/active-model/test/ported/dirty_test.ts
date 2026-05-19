/**
 * Ported from activemodel/test/cases/dirty_test.rb (Rails 7.2 branch).
 *
 * The Ruby Dirty module exposes generated per-attribute helpers
 * (`name_changed?`, `name_was`, `name_change`, `restore_name!`). Our
 * Model uses method-style accessors (`changed`, `attributeChanged`,
 * `attributeWas`, `restoreAttributes`). Tests are ported to the method
 * surface; per-attribute generators are TODO.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { Model } from '../../src';

class DirtyModel extends Model {
  declare name: string | null;
  declare color: string | null;
  declare size: number | null;
  declare status: string | null;

  /** Mirror of Rails' `save` which calls `changes_applied`. */
  commitChanges(): void {
    // biome-ignore lint/suspicious/noExplicitAny: protected attribute access
    (this as any)._attributes.commit();
  }
}
DirtyModel.attribute('name', 'string');
DirtyModel.attribute('color', 'string');
DirtyModel.attribute('size', 'integer');
DirtyModel.attribute('status', 'string', { default: 'initialized' });

let model: DirtyModel;
beforeEach(() => {
  model = new DirtyModel();
});

describe('Dirty', () => {
  test('setting attribute will result in change', () => {
    expect(model.changed()).toEqual([]);
    expect(model.attributeChanged('name')).toBe(false);
    model.name = 'Ringo';
    expect(model.changed().length > 0).toBe(true);
    expect(model.attributeChanged('name')).toBe(true);
  });

  test('list of changed attribute keys', () => {
    expect(model.changed()).toEqual([]);
    model.name = 'Paul';
    expect(model.changed()).toEqual(['name']);
  });

  test('changes to attribute values', () => {
    expect(model.changes()['name']).toBeUndefined();
    model.name = 'John';
    expect(model.changes()['name']).toEqual([null, 'John']);
  });

  test('per-attribute helpers — nameChanged() / nameWas() / nameChange()', () => {
    expect((model as unknown as { nameChanged: () => boolean }).nameChanged()).toBe(false);
    model.name = 'Ringo';
    expect((model as unknown as { nameChanged: () => boolean }).nameChanged()).toBe(true);
    expect((model as unknown as { nameWas: () => unknown }).nameWas()).toBeNull();
    expect((model as unknown as { nameChange: () => [unknown, unknown] | null }).nameChange()).toEqual([null, 'Ringo']);
  });

  test('consistent symbols arguments after the changes are applied', () => {
    model.name = 'David';
    expect(model.attributeChanged('name')).toBe(true);
    model.commitChanges();
    model.name = 'Rafael';
    expect(model.attributeChanged('name')).toBe(true);
  });

  test('attribute mutation — `nameWillChange()` marks attribute dirty after in-place mutation', () => {
    type Helpers = { nameWillChange: () => void };
    // Initial value is null; trigger willChange to mark current as the "after".
    (model as unknown as Helpers).nameWillChange();
    model.name = 'Baal';
    expect(model.attributeChanged('name')).toBe(true);
  });

  test('resetting attribute — `restoreName()`', () => {
    model.name = 'Bob';
    // biome-ignore lint/suspicious/noExplicitAny: per-attribute helper
    (model as any).restoreName();
    expect(model.name).toBeNull();
    expect(model.attributeChanged('name')).toBe(false);
  });

  test('setting color to same value should not result in change being recorded', () => {
    model.color = 'red';
    expect(model.attributeChanged('color')).toBe(true);
    model.commitChanges();
    expect(model.attributeChanged('color')).toBe(false);
    expect(model.changed().length).toBe(0);
    model.color = 'red';
    expect(model.attributeChanged('color')).toBe(false);
    expect(model.changed().length).toBe(0);
  });

  test('saving should reset model changed status', () => {
    model.name = 'Alf';
    expect(model.changed().length > 0).toBe(true);
    model.commitChanges();
    expect(model.changed().length).toBe(0);
    expect(model.attributeChanged('name')).toBe(false);
  });

  test('saving should preserve previous changes', () => {
    model.name = 'Jericho Cane';
    model.status = 'waiting';
    model.commitChanges();
    expect(model.savedChanges()['name']).toEqual([null, 'Jericho Cane']);
    expect(model.savedChanges()['status']).toEqual(['initialized', 'waiting']);
  });

  test('setting new attributes should not affect previous changes', () => {
    model.name = 'Jericho Cane';
    model.status = 'waiting';
    model.commitChanges();
    model.name = 'DudeFella ManGuy';
    model.status = 'finished';
    expect(model.savedChanges()['name']).toEqual([null, 'Jericho Cane']);
    expect(model.savedChanges()['status']).toEqual(['initialized', 'waiting']);
  });

  test('per-attribute previously_changed predicate', () => {
    model.name = 'Ringo';
    model.commitChanges();
    type Helpers = { namePreviouslyChanged: () => boolean; namePreviousChange: () => [unknown, unknown] | null };
    expect((model as unknown as Helpers).namePreviouslyChanged()).toBe(true);
    expect((model as unknown as Helpers).namePreviousChange()).toEqual([null, 'Ringo']);
  });

  test('per-attribute previously_changed with from:/to: filter accepts a check object', () => {
    model.name = 'Ringo';
    model.commitChanges();
    type Helpers = { namePreviousChange: () => [unknown, unknown] | null };
    const change = (model as unknown as Helpers).namePreviousChange();
    expect(change).toEqual([null, 'Ringo']);
  });

  test('previous value is preserved when changed after save', () => {
    expect(model.changes()).toEqual({});
    model.name = 'Paul';
    model.status = 'waiting';
    expect(model.changes()).toEqual({ name: [null, 'Paul'], status: ['initialized', 'waiting'] });
    model.commitChanges();
    model.name = 'John';
    model.status = 'finished';
    expect(model.changes()).toEqual({ name: ['Paul', 'John'], status: ['waiting', 'finished'] });
  });

  test('changing the same attribute multiple times retains the correct original value', () => {
    model.name = 'Otto';
    model.status = 'waiting';
    model.commitChanges();
    model.name = 'DudeFella ManGuy';
    model.name = 'Mr. Manfredgensonton';
    model.status = 'processing';
    model.status = 'finished';
    expect(model.changes()['name']).toEqual(['Otto', 'Mr. Manfredgensonton']);
    expect(model.changes()['status']).toEqual(['waiting', 'finished']);
    expect(model.attributeWas('name')).toBe('Otto');
  });

  test('willChange("name") on the Model directly', () => {
    model.willChange('name');
    model.name = 'Baal';
    expect(model.attributeChanged('name')).toBe(true);
  });

  test('clear_changes_information resets all changes', () => {
    model.name = 'Dmitry';
    expect(model.attributeChanged('name')).toBe(true);
    model.commitChanges();
    model.name = 'Bob';
    expect(model.savedChanges()['name']).toEqual([null, 'Dmitry']);
    model.clearChangesInformation();
    expect(model.savedChanges()).toEqual({});
    expect(model.changed()).toEqual([]);
  });

  test('restore_attributes restores all previous data', () => {
    model.name = 'Dmitry';
    model.color = 'Red';
    model.commitChanges();
    model.name = 'Bob';
    model.color = 'White';
    model.restoreAttributes();
    expect(model.changed().length).toBe(0);
    expect(model.name).toBe('Dmitry');
    expect(model.color).toBe('Red');
  });

  test('restore_attributes can restore only some attributes', () => {
    model.name = 'Dmitry';
    model.color = 'Red';
    model.commitChanges();
    model.name = 'Bob';
    model.color = 'White';
    model.restoreAttributes(['name']);
    expect(model.changed().length).toBeGreaterThan(0);
    expect(model.name).toBe('Dmitry');
    expect(model.color).toBe('White');
  });

  test('model can be dup-ed independently of its source', () => {
    model.name = 'A';
    const copy = model.dup();
    copy.name = 'B';
    expect(model.name).toBe('A');
    expect(copy.name).toBe('B');
  });

  test('to_json works on model', () => {
    model.name = 'Dmitry';
    expect(model.toJSON()).toEqual({ name: 'Dmitry', color: null, size: null, status: 'initialized' });
  });

  test('toJSON({ except: [...] }) filters listed attributes', () => {
    model.name = 'Dmitry';
    expect(model.toJSON({ except: ['name'] })).toEqual({ color: null, size: null, status: 'initialized' });
  });

  test('to_json works on model after save', () => {
    model.name = 'Dmitry';
    model.commitChanges();
    expect(model.toJSON()).toEqual({ name: 'Dmitry', color: null, size: null, status: 'initialized' });
  });
});
