import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import { Nodes } from '.';

type RelationType = any;
type CoreType = any[];
type LimitType = any | null;
type OrderType = any[];
type LockType = any | null;
type OffsetType = any | null;
type WithType = any | null;

export class SelectStatementNode extends NodeExpression {
  cores: CoreType;
  limit: LimitType;
  orders: OrderType;
  lock: LockType;
  offset: OffsetType;
  with: WithType;

  constructor(relation?: RelationType) {
    super();
    this.cores = [new Nodes.SelectCore(relation)];
    this.limit = null;
    this.orders = [];
    this.lock = null;
    this.offset = null;
    this.with = null;
  }

  override hash = () => hash([this.cores, this.limit, this.orders, this.lock, this.offset, this.with]);
}
