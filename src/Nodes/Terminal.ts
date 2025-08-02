import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';

export class DistinctNode extends NodeExpression {
  override hash = () => hash(DistinctNode.name);
}
