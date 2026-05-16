import type { Attribute } from '../Attribute';
import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import { isInfinity } from '../utilities/nodes';
import { UnaryNode } from './Unary';

/**
 * Wrapped value targeted at a specific column. `value` is typed as `unknown`
 * because the visitor's `quoteValue` step can handle any runtime payload
 * (primitive, Date, plain object → JSON, etc.) — restricting it to `Scalar`
 * would force callers to launder values through casts.
 */
export class CastedNode extends NodeExpression {
  public readonly value: unknown;
  public readonly attribute: Attribute;

  constructor(value: unknown, attribute: Attribute) {
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
