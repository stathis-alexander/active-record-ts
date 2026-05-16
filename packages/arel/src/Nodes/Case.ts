import { NodeExpression } from '../NodeExpression';
import type { Expression } from '../types';
import { lastOrThrow } from '../utilities/array';
import { hash } from '../utilities/hash';
import { buildQuoted } from '../utilities/nodes';
import { BinaryNode } from './Binary';
import { UnaryNode } from './Unary';

export class WhenNode extends BinaryNode {}
export class ElseNode extends UnaryNode {}

export class CaseNode extends NodeExpression {
  public case: Expression | null;
  public conditions: WhenNode[];
  /**
   * The `ELSE` branch. Typed as `ElseNode | Expression | null` so test fixtures
   * (matching Rails Arel's Ruby tests) can store raw values; `.else(...)` always
   * wraps in an `ElseNode`.
   */
  public default: ElseNode | Expression | null;

  constructor(expression?: Expression | null, defaultCase?: ElseNode | Expression | null) {
    super();
    this.case = expression ?? null;
    this.conditions = [];
    this.default = defaultCase ?? null;
  }

  override when = (condition: Expression, expression?: Expression) => {
    this.conditions.push(new WhenNode(buildQuoted(condition), expression));
    return this;
  };

  // biome-ignore lint/suspicious/noThenProperty: it's natural to call this `.then` and we aren't using promises
  then = (expression: Expression) => {
    lastOrThrow(this.conditions).right = buildQuoted(expression);
    return this;
  };

  else = (expression: Expression) => {
    this.default = new ElseNode(buildQuoted(expression));
    return this;
  };

  override hash = () => {
    return hash([this.case, this.conditions, this.default]);
  };
}
