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

  test.skip('checking if an attribute changed to particular value (TODO: name_changed?(from:, to:))', () => {});

  test.skip('changes accessible through strings and symbols (N/A: TS uses string keys)', () => {});

  test('consistent symbols arguments after the changes are applied', () => {
    model.name = 'David';
    expect(model.attributeChanged('name')).toBe(true);
    model.commitChanges();
    model.name = 'Rafael';
    expect(model.attributeChanged('name')).toBe(true);
  });

  test.skip('attribute mutation — `name_will_change!` (TODO: mutate-then-mark)', () => {});

  test.skip('resetting attribute — `restore_name!` (TODO: per-attribute restore)', () => {});

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

  test.skip('name_previously_changed? predicate (TODO: per-attribute previous_changed?)', () => {});
  test.skip('name_previously_changed? with from:/to: (TODO)', () => {});

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

  test.skip('attribute_will_change! with a symbol (TODO: will_change!)', () => {});

  test.skip('clear_changes_information resets all changes (TODO: clearChangesInformation)', () => {});

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

  test.skip('restore_attributes can restore only some attributes (TODO: selective restore)', () => {});

  test.skip('model can be dup-ed (TODO: dup support)', () => {});

  test('to_json works on model', () => {
    model.name = 'Dmitry';
    expect(model.toJSON()).toEqual({ name: 'Dmitry', color: null, size: null, status: 'initialized' });
  });

  test.skip('to_json with :except option (TODO: filter)', () => {});

  test('to_json works on model after save', () => {
    model.name = 'Dmitry';
    model.commitChanges();
    expect(model.toJSON()).toEqual({ name: 'Dmitry', color: null, size: null, status: 'initialized' });
  });
});
