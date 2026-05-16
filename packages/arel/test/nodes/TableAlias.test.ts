import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('TableAlias', () => {
  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const relation1 = new Arel.Table('users');
      const node1 = new Arel.Nodes.TableAlias(relation1, 'foo');
      const relation2 = new Arel.Table('users');
      const node2 = new Arel.Nodes.TableAlias(relation2, 'foo');

      expect(node1.isEqual(node2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const relation1 = new Arel.Table('users');
      const node1 = new Arel.Nodes.TableAlias(relation1, 'foo');
      const relation2 = new Arel.Table('users');
      const node2 = new Arel.Nodes.TableAlias(relation2, 'bar');

      expect(node1.isEqual(node2)).toBe(false);
    });
  });

  describe('to_cte', () => {
    it("returns a Cte node using the TableAlias's name and relation", () => {
      const relation = new Arel.Table('users').project(Arel.star);
      const tableAlias = new Arel.Nodes.TableAlias(relation, 'foo');
      const cte = tableAlias.toCte();

      expect(cte).toBeInstanceOf(Arel.Nodes.Cte);
      expect(cte.name).toBe('foo');
      expect(cte.relation).toBe(relation);
    });
  });
});
