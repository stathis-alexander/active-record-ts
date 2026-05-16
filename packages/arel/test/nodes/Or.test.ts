import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Or', () => {
  describe('or', () => {
    it('makes an OR node', () => {
      const table = new Arel.Table('users');
      const attr = table.attribute('id');
      const left = attr.equal(10);
      const right = attr.equal(11);
      const node = left.or(right);

      expect(node.expression.left).toBe(left);
      expect(node.expression.right).toBe(right);

      const oror = node.or(right);
      expect(oror.expression.left).toBe(node);
      expect(oror.expression.right).toBe(right);

      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
      expect(node.expression).toBeInstanceOf(Arel.Nodes.Or);
      expect(oror).toBeInstanceOf(Arel.Nodes.Grouping);
      expect(oror.expression).toBeInstanceOf(Arel.Nodes.Or);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const or1 = new Arel.Nodes.Or(['foo', 'bar']);
      const or2 = new Arel.Nodes.Or(['foo', 'bar']);

      expect(or1.isEqual(or2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const or1 = new Arel.Nodes.Or(['foo', 'bar']);
      const or2 = new Arel.Nodes.Or(['foo', 'baz']);

      expect(or1.isEqual(or2)).toBe(false);
    });
  });
});
