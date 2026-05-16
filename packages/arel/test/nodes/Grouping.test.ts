import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Grouping', () => {
  it('should create Equality nodes', () => {
    const grouping = new Arel.Nodes.Grouping(Arel.buildQuoted('foo'));
    const sql = grouping.equal('foo').toSql();
    expect(sql).toMatch(/\('foo'\)\s*=\s*'foo'/);
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const grouping1 = new Arel.Nodes.Grouping('foo');
      const grouping2 = new Arel.Nodes.Grouping('foo');

      expect(grouping1.isEqual(grouping2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const grouping1 = new Arel.Nodes.Grouping('foo');
      const grouping2 = new Arel.Nodes.Grouping('bar');

      expect(grouping1.isEqual(grouping2)).toBe(false);
    });
  });
});
