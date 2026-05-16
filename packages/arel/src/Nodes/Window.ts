import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { Node } from './Node';
import { SqlLiteralNode } from './SqlLiteral';
import { type ExpressionType, UnaryNode } from './Unary';

export class CurrentRowNode extends Node {
  override hash = () => hash(CurrentRowNode.name);
}

export class RowsNode extends UnaryNode {
  constructor(expression: ExpressionType = null) {
    super(expression);
  }
}
export class RangeNode extends UnaryNode {
  constructor(expression: ExpressionType = null) {
    super(expression);
  }
}
export class PrecedingNode extends UnaryNode {
  constructor(expression: ExpressionType = null) {
    super(expression);
  }
}
export class FollowingNode extends UnaryNode {
  constructor(expression: ExpressionType = null) {
    super(expression);
  }
}

type Framing = Node | null;

export class WindowNode extends Node {
  public orders: Expression[];
  public partitions: Expression[];
  public framing: Framing;

  constructor() {
    super();
    this.orders = [];
    this.partitions = [];
    this.framing = null;
  }

  order = (...orders: Expression[]) => {
    orders.forEach((order) => {
      if (typeof order === 'string') {
        this.orders.push(new SqlLiteralNode(order));
      } else {
        this.orders.push(order);
      }
    });
    return this;
  };

  partition = (...partitions: Expression[]) => {
    partitions.forEach((partition) => {
      if (typeof partition === 'string') {
        this.partitions.push(new SqlLiteralNode(partition));
      } else {
        this.partitions.push(partition);
      }
    });
    return this;
  };

  frame = <T extends Framing>(expression: T): T => {
    this.framing = expression;
    return expression;
  };

  rows = (expression?: ExpressionType) => {
    if (this.framing) return new RowsNode(expression ?? null);

    return this.frame(new RowsNode(expression ?? null));
  };

  range = (expression?: ExpressionType) => {
    if (this.framing) return new RangeNode(expression ?? null);

    return this.frame(new RangeNode(expression ?? null));
  };

  override hash() {
    return hash([this.orders, this.framing]);
  }
}

export class NamedWindowNode extends WindowNode {
  public name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  override hash() {
    return super.hash() ^ hash(this.name);
  }
}
