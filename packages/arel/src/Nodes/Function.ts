import { FilterPredications } from '../FilterPredications';
import { NodeExpression } from '../NodeExpression';
import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { WindowPredications } from '../WindowPredications';

export class FunctionNode extends WindowPredications(FilterPredications(NodeExpression)) {
  public expressions: Expression | Expression[];
  public distinct: boolean = false;

  constructor(expressions: Expression | Expression[]) {
    super();
    this.expressions = expressions;
  }

  override hash() {
    return hash([this.expressions, this.distinct]);
  }
}

export class AverageNode extends FunctionNode {}
export class ExistsNode extends FunctionNode {}
export class MaximumNode extends FunctionNode {}
export class MinimumNode extends FunctionNode {}
export class SumNode extends FunctionNode {}
