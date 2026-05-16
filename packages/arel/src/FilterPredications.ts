import { Nodes } from './Nodes';
import type { ArelOperand, Expression } from './types';
import type { Constructor } from './utilities/mixins';

export const FilterPredications = <TBase extends Constructor>(Base: TBase) =>
  class FilterPredications extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;
    filter = (expression: Expression) => new Nodes.Filter(this, expression);
  };
