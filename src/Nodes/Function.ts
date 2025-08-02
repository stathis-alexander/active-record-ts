import { FilterPredications } from '../FilterPredications';
import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import { WindowPredications } from '../WindowPredications';

export type ExpressionsType = any[] | any;

export class FunctionNode extends WindowPredications(FilterPredications(NodeExpression)) {
  public expressions: ExpressionsType;
  public distinct: boolean = false;

  constructor(expressions: ExpressionsType) {
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
