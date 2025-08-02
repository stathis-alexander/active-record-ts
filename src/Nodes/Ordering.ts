import { UnaryNode } from './Unary';

export class OrderingNode extends UnaryNode {
  nullsFirst = () => new NullsFirstNode(this);
  nullsLast = () => new NullsLastNode(this);
}

export class NullsFirstNode extends OrderingNode {
  reverse = () => new NullsLastNode(this.expression.reverse());
}

export class NullsLastNode extends OrderingNode {
  reverse = () => new NullsFirstNode(this.expression.reverse());
}
