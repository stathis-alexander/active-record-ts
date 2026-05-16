import { describe, expect, it } from 'bun:test';
import type { Expression, RelationLike, SelectCoreNode } from '../../src';
import Arel from '../../src';

/** Builds a SelectCore, then stamps it with primitive fixture props for hash-equality tests. */
const makeCore = (props: Record<string, unknown> = {}): SelectCoreNode & Record<string, unknown> => {
  const core = new Arel.Nodes.SelectCore();
  Object.assign(core, props);
  return core as SelectCoreNode & Record<string, unknown>;
};

describe('SelectCore', () => {
  it('sets properties', () => {
    const core = makeCore({
      froms: ['a', 'b', 'c'],
      projections: ['d', 'e', 'f'],
      wheres: ['g', 'h', 'i'],
    });

    // The fixture overwrites typed AST fields with string sentinels for hash equality;
    // bun's `toEqual` is strict about element types, so widen the expected value.
    expect(core.froms).toEqual(['a', 'b', 'c'] as unknown as RelationLike);
    expect(core.projections).toEqual(['d', 'e', 'f'] as unknown as Expression[]);
    expect(core.wheres).toEqual(['g', 'h', 'i'] as unknown as Expression[]);
  });

  it('test_set_quantifier', () => {
    const core = makeCore({ setQuantifier: new Arel.Nodes.Distinct() });
    expect(core.setQuantifier).toBeInstanceOf(Arel.Nodes.Distinct);
  });

  it('equality with same ivars', () => {
    const fixture = {
      froms: ['a', 'b', 'c'],
      projections: ['d', 'e', 'f'],
      wheres: ['g', 'h', 'i'],
      groups: ['j', 'k', 'l'],
      windows: ['m', 'n', 'o'],
      havings: ['p', 'q', 'r'],
      comment: new Arel.Nodes.Comment(['comment']),
    };
    const core1 = makeCore(fixture);
    const core2 = makeCore(fixture);

    expect(core1.isEqual(core2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const core1 = makeCore({
      froms: ['a', 'b', 'c'],
      projections: ['d', 'e', 'f'],
      wheres: ['g', 'h', 'i'],
      groups: ['j', 'k', 'l'],
      windows: ['m', 'n', 'o'],
      havings: ['p', 'q', 'r'],
      comment: new Arel.Nodes.Comment(['comment']),
    });

    const core2 = makeCore({
      froms: ['a', 'b', 'c'],
      projections: ['d', 'e', 'f'],
      wheres: ['g', 'h', 'i'],
      groups: ['j', 'k', 'l'],
      windows: ['m', 'n', 'o'],
      havings: ['l', 'o', 'l'],
      comment: new Arel.Nodes.Comment(['comment']),
    });

    expect(core1.isEqual(core2)).toBe(false);

    core2.havings = ['p', 'q', 'r'];
    core2.comment = new Arel.Nodes.Comment(['other']);

    expect(core1.isEqual(core2)).toBe(false);
  });
});
