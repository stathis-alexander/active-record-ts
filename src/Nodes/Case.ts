import { NodeExpression } from '../NodeExpression';
import { lastOrThrow } from '../utilities/array';
import { hash } from '../utilities/hash';
import { buildQuoted } from '../utilities/nodes';
import { BinaryNode, type RightType } from './Binary';
import { UnaryNode } from './Unary';

export class WhenNode extends BinaryNode {}
export class ElseNode extends UnaryNode {}

type CaseType = any;
type ConditionType = any;
type ConditionsType = ConditionType[];
type DefaultType = any;

export class CaseNode extends NodeExpression {
  public case: CaseType;
  public conditions: ConditionsType;
  public default: DefaultType;

  constructor(expression?: CaseType, defaultCase?: DefaultType) {
    super();
    this.case = expression;
    this.conditions = [];
    this.default = defaultCase;
  }

  override when = (condition: ConditionType, expression?: RightType) => {
    this.conditions.push(new WhenNode(buildQuoted(condition), expression));
    return this;
  };

  // biome-ignore lint/suspicious/noThenProperty: it's natural to call this `.then` and we aren't using promises
  then = (expression: RightType) => {
    lastOrThrow(this.conditions).right = buildQuoted(expression);
    return this;
  };

  else = (expression: DefaultType) => {
    this.default = new ElseNode(buildQuoted(expression));
    return this;
  };

  override hash = () => {
    return hash([this.case, this.conditions, this.default]);
  };
}
