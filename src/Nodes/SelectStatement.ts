import { NodeExpression } from '../NodeExpression';
import type { Expression, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import { Nodes } from '.';
import type { SelectCoreNode } from './SelectCore';
import type { LimitNode, LockNode, OffsetNode } from './Unary';
import type { WithNode, WithRecursiveNode } from './With';

export class SelectStatementNode extends NodeExpression {
  cores: SelectCoreNode[];
  limit: LimitNode | null;
  orders: Expression[];
  lock: LockNode | null;
  offset: OffsetNode | null;
  with: WithNode | WithRecursiveNode | null;

  constructor(relation?: RelationLike) {
    super();
    this.cores = [new Nodes.SelectCore(relation)];
    this.limit = null;
    this.orders = [];
    this.lock = null;
    this.offset = null;
    this.with = null;
  }

  get froms(): RelationLike[] {
    return this.cores.map((c) => c.from).filter((f): f is RelationLike => Boolean(f));
  }

  override hash = () => hash([this.cores, this.limit, this.orders, this.lock, this.offset, this.with]);
}
