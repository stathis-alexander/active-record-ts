import { UnaryNode } from './Unary';

/** An order-direction node (Ascending/Descending) — supports `.reverse()`. */
type Reversible = { reverse: () => OrderingNode };

export class OrderingNode extends UnaryNode {
  nullsFirst = () => new NullsFirstNode(this);
  nullsLast = () => new NullsLastNode(this);
}

export class NullsFirstNode extends OrderingNode {
  reverse = () => new NullsLastNode((this.expression as Reversible).reverse());
}

export class NullsLastNode extends OrderingNode {
  reverse = () => new NullsFirstNode((this.expression as Reversible).reverse());
}
