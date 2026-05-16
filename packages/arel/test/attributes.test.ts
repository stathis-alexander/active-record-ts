import { describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('Attributes', () => {
  it('responds to lower', () => {
    const relation = new Arel.Table('users');
    const attribute = relation.attribute('foo');
    const node = attribute.lower();
    expect(node.name).toBe('LOWER');
    expect(node.expressions).toEqual([attribute]);
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const table = new Arel.Table('bar');
      const attr1 = new Arel.Attribute(table, 'foo');
      const attr2 = new Arel.Attribute(table, 'foo');
      expect(attr1.name).toBe(attr2.name);
      expect(attr1.relation).toBe(attr2.relation);
    });

    it('is not equal with different ivars', () => {
      const table1 = new Arel.Table('bar');
      const table2 = new Arel.Table('baz');
      const attr1 = new Arel.Attribute(table1, 'foo');
      const attr2 = new Arel.Attribute(table2, 'foo');
      expect(attr1.name).toBe(attr2.name);
      expect(attr1.relation).not.toBe(attr2.relation);
    });
  });
});
