import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Comment', () => {
  describe('equality', () => {
    it('is equal with equal contents', () => {
      const x = new Arel.Nodes.Comment(['foo']);
      const y = new Arel.Nodes.Comment(['foo']);
      expect(x.isEqual(y)).toBe(true);
    });

    it('is not equal with different contents', () => {
      const x = new Arel.Nodes.Comment(['foo']);
      const y = new Arel.Nodes.Comment(['bar']);
      expect(x.isEqual(y)).toBe(false);
    });
  });
});
