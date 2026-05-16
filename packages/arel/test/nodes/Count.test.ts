import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Count', () => {
  it('should alias the count', () => {
    const table = new Arel.Table('users');
    expect(table.attribute('id').count().as('foo').toSql()).toBe('COUNT("users"."id") AS foo');
  });

  it('should compare the count', () => {
    const table = new Arel.Table('users');
    expect(table.attribute('id').count().equal(2).toSql()).toBe('COUNT("users"."id") = 2');
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const x = new Arel.Nodes.Count('foo');
      const y = new Arel.Nodes.Count('foo');
      expect(x.isEqual(y)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const x = new Arel.Nodes.Count('foo');
      const y = new Arel.Nodes.Count('foo!');
      expect(x.isEqual(y)).toBe(false);
    });
  });
});
