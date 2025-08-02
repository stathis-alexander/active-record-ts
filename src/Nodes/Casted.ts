import type { Attribute } from '../Attribute';
import { NodeExpression } from '../NodeExpression';
import type { Scalar } from '../types';
import { hash } from '../utilities/hash';
import { isInfinity } from '../utilities/nodes';
import { UnaryNode } from './Unary';

type ValueType = Scalar;
type AttributeType = Attribute;

export class CastedNode extends NodeExpression {
  public readonly value: ValueType;
  public readonly attribute: AttributeType;

  constructor(value: ValueType, attribute: AttributeType) {
    super();
    this.value = value;
    this.attribute = attribute;
  }

  valueBeforeTypeCast = () => this.value;
  valueForDatabase = () => {
    if (this.attribute.ableToTypeCast()) return this.attribute.typeCastForDatabase(this.value);

    return this.value;
  };

  override hash = () => hash([this.constructor.name, this.value, this.attribute]);
  override isNull = () => this.value == null;
}

export class QuotedNode extends UnaryNode {
  valueBeforeTypeCast = () => this.value;
  valueForDatabase = () => this.value;
  override isNull = () => this.value == null;
  isInfinity = (): number => isInfinity(this.value);
}
