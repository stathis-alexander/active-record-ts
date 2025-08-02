import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';

export class FalseNode extends NodeExpression {
  override hash = () => hash(this.constructor.name);
}
