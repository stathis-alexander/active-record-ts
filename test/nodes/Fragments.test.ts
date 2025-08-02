import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Fragments', () => {
  describe('equality', () => {
    it('is equal with equal values', () => {
      const fragments1 = new Arel.Nodes.Fragments(['foo', 'bar']);
      const fragments2 = new Arel.Nodes.Fragments(['foo', 'bar']);

      expect(fragments1.isEqual(fragments2)).toBe(true);
    });

    it('is not equal with different values', () => {
      const fragments1 = new Arel.Nodes.Fragments(['foo']);
      const fragments2 = new Arel.Nodes.Fragments(['bar']);

      expect(fragments1.isEqual(fragments2)).toBe(false);
    });

    it('can be joined with other nodes', () => {
      const fragments = new Arel.Nodes.Fragments(['foo', 'bar']);
      const sql = Arel.sql('SELECT');
      const joinedFragments = fragments.add(sql);

      expect(fragments.values).toEqual(['foo', 'bar']);
      expect(joinedFragments.values).toEqual(['foo', 'bar', sql]);
    });

    it('fails if joined with something that is not an Arel node', () => {
      const fragments = new Arel.Nodes.Fragments([]);

      expect(() => {
        fragments.add('Not a node');
      }).toThrow('Expected a node');
    });
  });
});
