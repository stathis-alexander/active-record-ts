import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('And', () => {
  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const x = new Arel.Nodes.And(['foo', 'bar']);
      const y = new Arel.Nodes.And(['foo', 'bar']);
      expect(x.isEqual(y)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const x = new Arel.Nodes.And(['bar', 'foo']);
      const y = new Arel.Nodes.And(['foo', 'bar']);
      expect(x.isEqual(y)).toBe(false);
    });
  });

  describe('functions as node expression', () => {
    it('allows aliasing', () => {
      const aliased = new Arel.Nodes.And(['foo', 'bar']).as('baz');
      expect(aliased).toBeInstanceOf(Arel.Nodes.As);
      expect(aliased.right).toBeInstanceOf(Arel.Nodes.SqlLiteral);
    });
  });
});
