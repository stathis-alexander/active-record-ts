import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

// module Arel
//   module Nodes
//     class NodesTest < Arel::Spec
//       describe "Case" do
//         describe "#initialize" do
//           it "sets case expression from first argument" do
//             node = Case.new "foo"

//             assert_equal "foo", node.case
//           end

//           it "sets default case from second argument" do
//             node = Case.new nil, "bar"

//             assert_equal "bar", node.default
//           end
//         end

//         describe "equality" do
//           it "is equal with equal ivars" do
//             foo = Nodes.build_quoted "foo"
//             one = Nodes.build_quoted 1
//             zero = Nodes.build_quoted 0

//             case1 = Case.new foo
//             case1.conditions = [When.new(foo, one)]
//             case1.default = Else.new zero

//             case2 = Case.new foo
//             case2.conditions = [When.new(foo, one)]
//             case2.default = Else.new zero

//             array = [case1, case2]

//             assert_equal 1, array.uniq.size
//           end

//           it "is not equal with different ivars" do
//             foo = Nodes.build_quoted "foo"
//             bar = Nodes.build_quoted "bar"
//             one = Nodes.build_quoted 1
//             zero = Nodes.build_quoted 0

//             case1 = Case.new foo
//             case1.conditions = [When.new(foo, one)]
//             case1.default = Else.new zero

//             case2 = Case.new foo
//             case2.conditions = [When.new(bar, one)]
//             case2.default = Else.new zero

//             array = [case1, case2]

//             assert_equal 2, array.uniq.size
//           end
//         end

//         describe "#as" do
//           it "allows aliasing" do
//             node = Case.new "foo"
//             as = node.as("bar")

//             assert_equal node, as.left
//             assert_kind_of Arel::Nodes::SqlLiteral, as.right
//           end
//         end
//       end
//     end
//   end
// end

describe('case', () => {
  it('sets case expression from first argument', () => {
    const node = new Arel.Nodes.Case('foo');

    expect(node.case).toEqual('foo');
  });

  it('sets default case from second argument', () => {
    const node = new Arel.Nodes.Case(null, 'bar');

    expect(node.default).toEqual('bar');
  });

  // describe('clone', () => {
  //   it('clones case, conditions and default', () => {
  //     const foo = Arel.buildQuoted('foo');

  //     const node = new Arel.Nodes.Case();
  //     node.case = foo;
  //     node.conditions = [new Arel.Nodes.When(foo, foo)];
  //     node.default = foo;

  //     // Note: Clone functionality may not be implemented yet in TypeScript version
  //     // This test validates the structure instead
  //     expect(node.case).toBe(foo);
  //     expect(node.conditions).toEqual([new Arel.Nodes.When(foo, foo)]);
  //     expect(node.default).toBe(foo);
  //   });
  // });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const foo = Arel.buildQuoted('foo');
      const one = Arel.buildQuoted(1);
      const zero = Arel.buildQuoted(0);

      const case1 = new Arel.Nodes.Case(foo);
      case1.conditions = [new Arel.Nodes.When(foo, one)];
      case1.default = new Arel.Nodes.Else(zero);

      const case2 = new Arel.Nodes.Case(foo);
      case2.conditions = [new Arel.Nodes.When(foo, one)];
      case2.default = new Arel.Nodes.Else(zero);

      expect(case1.isEqual(case2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const foo = Arel.buildQuoted('foo');
      const bar = Arel.buildQuoted('bar');
      const one = Arel.buildQuoted(1);
      const zero = Arel.buildQuoted(0);

      const case1 = new Arel.Nodes.Case(foo);
      case1.conditions = [new Arel.Nodes.When(foo, one)];
      case1.default = new Arel.Nodes.Else(zero);

      const case2 = new Arel.Nodes.Case(foo);
      case2.conditions = [new Arel.Nodes.When(bar, one)];
      case2.default = new Arel.Nodes.Else(zero);

      expect(case1.isEqual(case2)).toBe(false);
    });
  });

  describe('as', () => {
    it('allows aliasing', () => {
      const node = new Arel.Nodes.Case('foo');
      const as = node.as('bar');

      expect(as.left).toEqual(node);
      expect(as.right).toBeInstanceOf(Arel.Nodes.SqlLiteral);
    });
  });
});
