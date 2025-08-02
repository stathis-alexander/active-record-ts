import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';

export const FilterPredications = <TBase extends Constructor>(Base: TBase) =>
  class FilterPredications extends Base {
    filter = (expression: any) => new Nodes.Filter(this, expression);
  };
