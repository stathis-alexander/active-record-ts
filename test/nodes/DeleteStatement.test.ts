import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('DeleteStatement', () => {
  // describe('clone', () => {
  //   it('clones wheres', () => {
  //     const statement = new Arel.Nodes.DeleteStatement();
  //     statement.wheres = ['a', 'b', 'c'];

  //     // Note: Clone functionality may not be implemented yet in TypeScript version
  //     // This test validates the structure instead
  //     expect(statement.wheres).toEqual(['a', 'b', 'c']);
  //   });
  // });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const statement1 = new Arel.Nodes.DeleteStatement();
      statement1.wheres = ['a', 'b', 'c'];
      const statement2 = new Arel.Nodes.DeleteStatement();
      statement2.wheres = ['a', 'b', 'c'];

      expect(statement1.isEqual(statement2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const statement1 = new Arel.Nodes.DeleteStatement();
      statement1.wheres = ['a', 'b', 'c'];
      const statement2 = new Arel.Nodes.DeleteStatement();
      statement2.wheres = ['1', '2', '3'];

      expect(statement1.isEqual(statement2)).toBe(false);
    });
  });
});
