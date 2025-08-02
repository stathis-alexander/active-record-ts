import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('SelectCore', () => {
  it('sets properties', () => {
    const core = new Arel.Nodes.SelectCore();
    core.froms = ['a', 'b', 'c'];
    core.projections = ['d', 'e', 'f'];
    core.wheres = ['g', 'h', 'i'];

    expect(core.froms).toEqual(['a', 'b', 'c']);
    expect(core.projections).toEqual(['d', 'e', 'f']);
    expect(core.wheres).toEqual(['g', 'h', 'i']);
  });

  it('test_set_quantifier', () => {
    const core = new Arel.Nodes.SelectCore();
    core.setQuantifier = new Arel.Nodes.Distinct();
    // Note: This would need a proper ToSql visitor test which is complex
    expect(core.setQuantifier).toBeInstanceOf(Arel.Nodes.Distinct);
  });

  it('equality with same ivars', () => {
    const core1 = new Arel.Nodes.SelectCore();
    core1.froms = ['a', 'b', 'c'];
    core1.projections = ['d', 'e', 'f'];
    core1.wheres = ['g', 'h', 'i'];
    core1.groups = ['j', 'k', 'l'];
    core1.windows = ['m', 'n', 'o'];
    core1.havings = ['p', 'q', 'r'];
    core1.comment = new Arel.Nodes.Comment(['comment']);

    const core2 = new Arel.Nodes.SelectCore();
    core2.froms = ['a', 'b', 'c'];
    core2.projections = ['d', 'e', 'f'];
    core2.wheres = ['g', 'h', 'i'];
    core2.groups = ['j', 'k', 'l'];
    core2.windows = ['m', 'n', 'o'];
    core2.havings = ['p', 'q', 'r'];
    core2.comment = new Arel.Nodes.Comment(['comment']);

    expect(core1.isEqual(core2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const core1 = new Arel.Nodes.SelectCore();
    core1.froms = ['a', 'b', 'c'];
    core1.projections = ['d', 'e', 'f'];
    core1.wheres = ['g', 'h', 'i'];
    core1.groups = ['j', 'k', 'l'];
    core1.windows = ['m', 'n', 'o'];
    core1.havings = ['p', 'q', 'r'];
    core1.comment = new Arel.Nodes.Comment(['comment']);

    const core2 = new Arel.Nodes.SelectCore();
    core2.froms = ['a', 'b', 'c'];
    core2.projections = ['d', 'e', 'f'];
    core2.wheres = ['g', 'h', 'i'];
    core2.groups = ['j', 'k', 'l'];
    core2.windows = ['m', 'n', 'o'];
    core2.havings = ['l', 'o', 'l'];
    core2.comment = new Arel.Nodes.Comment(['comment']);

    expect(core1.isEqual(core2)).toBe(false);

    core2.havings = ['p', 'q', 'r'];
    core2.comment = new Arel.Nodes.Comment(['other']);

    expect(core1.isEqual(core2)).toBe(false);
  });
});
