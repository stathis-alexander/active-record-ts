import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('SelectStatement', () => {
  describe('cores', () => {
    it('has cores array', () => {
      const statement = new Arel.Nodes.SelectStatement(['a', 'b', 'c']);
      expect(statement.cores).toBeInstanceOf(Array);
      expect(statement.cores.length).toBe(1);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const statement1 = new Arel.Nodes.SelectStatement(['a', 'b', 'c']);
      statement1.offset = 1;
      statement1.limit = 2;
      statement1.lock = false;
      statement1.orders = ['x', 'y', 'z'];
      statement1.with = 'zomg';

      const statement2 = new Arel.Nodes.SelectStatement(['a', 'b', 'c']);
      statement2.offset = 1;
      statement2.limit = 2;
      statement2.lock = false;
      statement2.orders = ['x', 'y', 'z'];
      statement2.with = 'zomg';

      expect(statement1.isEqual(statement2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const statement1 = new Arel.Nodes.SelectStatement(['a', 'b', 'c']);
      statement1.offset = 1;
      statement1.limit = 2;
      statement1.lock = false;
      statement1.orders = ['x', 'y', 'z'];
      statement1.with = 'zomg';

      const statement2 = new Arel.Nodes.SelectStatement(['a', 'b', 'c']);
      statement2.offset = 1;
      statement2.limit = 2;
      statement2.lock = false;
      statement2.orders = ['x', 'y', 'z'];
      statement2.with = 'wth';

      expect(statement1.isEqual(statement2)).toBe(false);
    });
  });
});
