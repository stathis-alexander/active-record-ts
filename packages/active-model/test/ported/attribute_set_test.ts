/**
 * Ported from activemodel/test/cases/attribute_set_test.rb (Rails 7.2 branch).
 *
 * Our AttributeSet/Attributes pair is simpler than Rails' — no
 * Attribute-with-Type wrapper objects, no LazyAttributeHash, no
 * accessed-attribute tracking, no separate write_from_user vs
 * write_from_database paths. Most tests of the lazy/accessed machinery
 * are skipped; tests of the core typed read/write/dirty surface are
 * ported.
 */

import { describe, expect, test } from 'bun:test';
import { AttributeSet, Attributes, FloatType, IntegerType, StringType } from '../../src';

const buildSet = (defs: Array<[string, ConstructorParameters<typeof Attributes>[0] extends never ? never : { type: { type: string } }]> | Record<string, { type: string }> = {}): AttributeSet => {
  const set = new AttributeSet();
  for (const [name, def] of Object.entries(defs as Record<string, { type: string }>)) {
    let type;
    switch (def.type) {
      case 'integer': type = new IntegerType(); break;
      case 'float':   type = new FloatType(); break;
      case 'string':  type = new StringType(); break;
      default:        throw new Error(`Unsupported test type: ${def.type}`);
    }
    set.define({ name, type });
  }
  return set;
};

describe('AttributeSet', () => {
  test('building from raw attributes casts via type', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.read('foo')).toBe(1);
    expect(attrs.read('bar')).toBe(2.2);
  });

  test.skip('building with extra per-call types (TODO: extra types at hydrate)', () => {});
  test.skip('[] returns a null object for unknown attributes (TODO: null-object wrapper)', () => {});

  test('cloning AttributeSet is independent', () => {
    const a = buildSet({ foo: { type: 'integer' } });
    const b = a.clone();
    b.define({ name: 'bar', type: new StringType() });
    expect(a.has('bar')).toBe(false);
    expect(b.has('bar')).toBe(true);
  });

  test.skip('deep_dup duplicates each attribute (TODO)', () => {});
  test.skip('freezing cloned set does not freeze original (TODO: frozen)', () => {});

  test('toHash returns the cast values', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.toHash()).toEqual({ foo: 1, bar: 2.2 });
  });

  test('toHash maintains insertion order', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '2.2', bar: '3.3' });
    expect(Object.entries(attrs.toHash())).toEqual([
      ['foo', 2],
      ['bar', 3.3],
    ]);
  });

  test.skip('values_before_type_cast (TODO: raw values cache)', () => {});

  test.skip('uninitialized attributes are excluded (TODO: initialized? tracking)', () => {});
  test.skip('uninitialized attributes excluded from to_hash (TODO)', () => {});
  test.skip('uninitialized attributes excluded from keys (TODO)', () => {});
  test.skip('uninitialized attributes return false for key? (TODO)', () => {});
  test.skip('unknown attributes return false for key? (TODO)', () => {});

  test('fetch_value returns the cast value', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.read('foo')).toBe(1);
    expect(attrs.read('bar')).toBe(2.2);
  });

  test.skip('fetch_value returns nil for unknown attributes (TODO: nil for unknown)', () => {});
  test.skip('fetch_value block fallback (TODO: block fallback)', () => {});

  test.skip('primary key always initialized (TODO: defaults+initialized)', () => {});

  test.skip('write_from_database with custom type (TODO: db vs user writes)', () => {});
  test.skip('write_from_user with custom type (TODO: db vs user writes)', () => {});

  test('serializedHash mirrors values_for_database', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '7' });
    expect(attrs.serializedHash()).toEqual({ foo: 7 });
  });

  test.skip('freezing doesn\'t prevent materialization (TODO: frozen)', () => {});
  test.skip('marshalling dump/load (TODO: marshalling)', () => {});
  test.skip('accessed_attributes returns read ones (TODO: accessed tracking)', () => {});
  test.skip('map returns a new set with changes (TODO: map)', () => {});
  test.skip('comparison for equality (TODO: equality)', () => {});
  test.skip('==(other) safe with any instance (TODO)', () => {});
  test.skip('custom mutable type changed_in_place (TODO)', () => {});

  test('keys returns names in declaration order', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'integer' } });
    expect(set.keys()).toEqual(['foo', 'bar']);
  });
});
